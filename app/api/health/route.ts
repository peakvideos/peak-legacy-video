import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailJobs } from "@/lib/db/schema";
import {
  getAvailability,
  isGoogleCalendarConfigured,
  ptToday,
} from "@/lib/google-calendar";
import { isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

// A pending job this far past its sendAt means the cron trigger is dead —
// the worker would have picked it up within one ~10-minute tick otherwise.
const QUEUE_STALL_THRESHOLD_MIN = 30;

// A job only reaches `failed` after exhausting all retries, so any recent
// one signals a delivery-level problem (SMTP auth, revoked App Password).
const DELIVERY_FAILURE_WINDOW_HOURS = 24;

type CheckStatus = "ok" | "not_configured" | "error";

async function checkCalendar(): Promise<CheckStatus> {
  if (!isGoogleCalendarConfigured()) return "not_configured";
  try {
    // Exercises the OAuth refresh token end-to-end via a freebusy query.
    await getAvailability(ptToday());
    return "ok";
  } catch (err) {
    console.error("[health] calendar probe failed", err);
    return "error";
  }
}

async function checkEmailQueue(): Promise<CheckStatus> {
  try {
    const threshold = new Date(
      Date.now() - QUEUE_STALL_THRESHOLD_MIN * 60_000,
    );
    const [stalled] = await db
      .select({ id: emailJobs.id })
      .from(emailJobs)
      .where(
        and(eq(emailJobs.status, "pending"), lte(emailJobs.sendAt, threshold)),
      )
      .limit(1);
    if (stalled) {
      console.error(
        `[health] email queue stalled — pending job ${stalled.id} is >${QUEUE_STALL_THRESHOLD_MIN}min overdue`,
      );
      return "error";
    }
    return "ok";
  } catch (err) {
    console.error("[health] email queue probe failed", err);
    return "error";
  }
}

async function checkEmailDelivery(): Promise<CheckStatus> {
  if (!isEmailConfigured()) return "not_configured";
  try {
    const since = new Date(
      Date.now() - DELIVERY_FAILURE_WINDOW_HOURS * 60 * 60_000,
    );
    const [recentFailure] = await db
      .select({ id: emailJobs.id })
      .from(emailJobs)
      .where(
        and(eq(emailJobs.status, "failed"), gte(emailJobs.updatedAt, since)),
      )
      .limit(1);
    if (recentFailure) {
      console.error(
        `[health] email delivery failing — job ${recentFailure.id} exhausted retries within the last ${DELIVERY_FAILURE_WINDOW_HOURS}h`,
      );
      return "error";
    }
    return "ok";
  } catch (err) {
    console.error("[health] email delivery probe failed", err);
    return "error";
  }
}

export async function GET() {
  const [calendar, emailQueue, emailDelivery] = await Promise.all([
    checkCalendar(),
    checkEmailQueue(),
    checkEmailDelivery(),
  ]);

  const ok =
    calendar === "ok" && emailQueue === "ok" && emailDelivery === "ok";

  return NextResponse.json(
    { ok, checks: { calendar, emailQueue, emailDelivery } },
    { status: ok ? 200 : 503 },
  );
}
