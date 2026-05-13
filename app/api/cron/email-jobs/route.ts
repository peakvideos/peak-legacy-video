import { NextResponse } from "next/server";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailJobs, emailTemplates, leads, stageAutomations } from "@/lib/db/schema";
import { sendStoredTemplateEmail } from "@/lib/email";
import { unsubscribeUrlFor } from "@/lib/email/unsubscribe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 25;
const RETRY_BACKOFF_MIN = [1, 5, 30, 120, 360]; // minutes per attempt

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${expected}`;
}

async function processBatch() {
  const now = new Date();
  // Pick up due, pending jobs joined with their lead and template.
  const due = await db
    .select({
      jobId: emailJobs.id,
      templateId: emailJobs.templateId,
      attempts: emailJobs.attempts,
      leadId: leads.id,
      firstName: leads.firstName,
      lastName: leads.lastName,
      email: leads.email,
      packageInterest: leads.packageInterest,
      stage: leads.stage,
      unsubscribedAt: leads.unsubscribedAt,
      templateSubject: emailTemplates.subject,
      templateBody: emailTemplates.body,
      templateArchivedAt: emailTemplates.archivedAt,
    })
    .from(emailJobs)
    .innerJoin(leads, eq(emailJobs.leadId, leads.id))
    .innerJoin(emailTemplates, eq(emailJobs.templateId, emailTemplates.id))
    .where(and(eq(emailJobs.status, "pending"), lte(emailJobs.sendAt, now)))
    .orderBy(emailJobs.sendAt)
    .limit(BATCH_SIZE);

  let sent = 0;
  let cancelled = 0;
  let failed = 0;
  let retried = 0;

  for (const job of due) {
    // If the lead unsubscribed, cancel and move on — no email goes out.
    if (job.unsubscribedAt) {
      await db
        .update(emailJobs)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(emailJobs.id, job.jobId));
      cancelled++;
      continue;
    }

    // If the template has been archived, or the lead's current stage no
    // longer has this template attached as an automation, cancel the job.
    // This keeps in-flight queues consistent with the latest config.
    const stillRelevant = await isJobStillRelevant({
      stage: job.stage,
      templateId: job.templateId,
      templateArchived: job.templateArchivedAt != null,
    });
    if (!stillRelevant) {
      await db
        .update(emailJobs)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(emailJobs.id, job.jobId));
      cancelled++;
      continue;
    }

    const result = await sendStoredTemplateEmail({
      template: { subject: job.templateSubject, body: job.templateBody },
      to: job.email,
      lead: {
        firstName: job.firstName,
        lastName: job.lastName,
        email: job.email,
        packageInterest: job.packageInterest,
        bookingUrl:
          process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
        unsubscribeUrl: unsubscribeUrlFor(job.leadId),
      },
    });

    if (result.ok) {
      await db
        .update(emailJobs)
        .set({
          status: "sent",
          sentAt: new Date(),
          messageId: result.id ?? null,
          updatedAt: new Date(),
        })
        .where(eq(emailJobs.id, job.jobId));
      sent++;
      continue;
    }

    // Failure path — backoff and retry, or give up after MAX_ATTEMPTS.
    const nextAttempts = job.attempts + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      await db
        .update(emailJobs)
        .set({
          status: "failed",
          attempts: nextAttempts,
          lastError: result.error?.slice(0, 1000) ?? "unknown",
          updatedAt: new Date(),
        })
        .where(eq(emailJobs.id, job.jobId));
      failed++;
    } else {
      const backoffMin =
        RETRY_BACKOFF_MIN[Math.min(nextAttempts, RETRY_BACKOFF_MIN.length - 1)];
      const nextSendAt = new Date(Date.now() + backoffMin * 60_000);
      await db
        .update(emailJobs)
        .set({
          attempts: nextAttempts,
          sendAt: nextSendAt,
          lastError: result.error?.slice(0, 1000) ?? "unknown",
          updatedAt: new Date(),
        })
        .where(eq(emailJobs.id, job.jobId));
      retried++;
    }
  }

  return {
    picked: due.length,
    sent,
    cancelled,
    retried,
    failed,
  };
}

async function isJobStillRelevant(args: {
  stage: typeof leads.$inferSelect.stage;
  templateId: string;
  templateArchived: boolean;
}): Promise<boolean> {
  if (args.templateArchived) return false;
  const [match] = await db
    .select({ id: stageAutomations.id })
    .from(stageAutomations)
    .where(
      and(
        eq(stageAutomations.stage, args.stage),
        eq(stageAutomations.templateId, args.templateId),
      ),
    )
    .limit(1);
  return !!match;
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
