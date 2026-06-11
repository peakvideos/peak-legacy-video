import { NextResponse } from "next/server";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailJobs } from "@/lib/db/schema";
import { processEmailJob } from "@/lib/email/job-send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 25;

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${expected}`;
}

async function processBatch() {
  // Pick up due, pending jobs; each runs through the shared send pipeline —
  // the same one the outbox's "Send now" uses.
  const due = await db
    .select({ id: emailJobs.id })
    .from(emailJobs)
    .where(and(eq(emailJobs.status, "pending"), lte(emailJobs.sendAt, new Date())))
    .orderBy(emailJobs.sendAt)
    .limit(BATCH_SIZE);

  const counts = { sent: 0, cancelled: 0, retried: 0, failed: 0 };
  for (const job of due) {
    const { outcome } = await processEmailJob(job.id);
    counts[outcome]++;
  }

  return { picked: due.length, ...counts };
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const stats = await processBatch();
  return NextResponse.json({ ok: true, ...stats });
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const stats = await processBatch();
  return NextResponse.json({ ok: true, ...stats });
}
