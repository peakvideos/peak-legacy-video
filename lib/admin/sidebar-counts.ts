import "server-only";
import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, leads } from "@/lib/db/schema";
import type { AdminSidebarCounts } from "@/components/admin/admin-sidebar";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function loadSidebarCounts(): Promise<AdminSidebarCounts> {
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);

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
          ne(leads.stage, "closed"),
          ne(leads.stage, "lost"),
          lt(leads.updatedAt, fourteenDaysAgo),
        ),
      ),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(ne(leads.stage, "closed"), ne(leads.stage, "lost"))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.stage, "closed")),
  ]);

  return {
    inbox: inboxCount ?? 0,
    calls: callsCount ?? 0,
    stuck: stuckCount ?? 0,
    active: activeCount ?? 0,
    closed: closedCount ?? 0,
  };
}
