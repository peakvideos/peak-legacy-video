import "server-only";
import { and, eq, gte, inArray, lt, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, leads, stages } from "@/lib/db/schema";
import { getSettings } from "@/lib/stages/settings";
import type { AdminSidebarCounts } from "@/components/admin/admin-sidebar";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Subquery: ids of terminal stages (Won or Lost flag). */
function terminalStageIds() {
  return db
    .select({ id: stages.id })
    .from(stages)
    .where(or(eq(stages.isWon, true), eq(stages.isLost, true)));
}

export async function loadSidebarCounts(): Promise<AdminSidebarCounts> {
  const { coldThresholdDays } = await getSettings();
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * DAY_MS);
  const coldCutoff = new Date(now.getTime() - coldThresholdDays * DAY_MS);

  const [
    [{ value: inboxCount }],
    [{ value: callsCount }],
    [{ value: stuckCount }],
    [{ value: activeCount }],
    [{ value: closedCount }],
  ] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(leads),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "scheduled"),
          gte(bookings.scheduledAt, now),
          lt(bookings.scheduledAt, weekFromNow),
        ),
      ),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          notInArray(leads.stageId, terminalStageIds()),
          lt(leads.updatedAt, coldCutoff),
        ),
      ),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(leads)
      .where(notInArray(leads.stageId, terminalStageIds())),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        inArray(
          leads.stageId,
          db
            .select({ id: stages.id })
            .from(stages)
            .where(eq(stages.isWon, true)),
        ),
      ),
  ]);

  return {
    inbox: inboxCount ?? 0,
    calls: callsCount ?? 0,
    stuck: stuckCount ?? 0,
    active: activeCount ?? 0,
    closed: closedCount ?? 0,
  };
}
