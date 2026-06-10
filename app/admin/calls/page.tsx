import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, leads } from "@/lib/db/schema";
import { CallsView } from "@/components/admin/calls-view";
import { LeadDetailModal } from "@/components/admin/lead-detail-modal";
import { LeadDetailContent } from "@/components/admin/lead-detail-content";
import { loadLeadDetail } from "@/lib/admin/lead-detail";
import type { LeadRow } from "@/lib/admin/lead-rows";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const oneWeekOut = new Date(now.getTime() + 7 * DAY_MS);

  const rows = await db
    .select({
      lead: leads,
      booking: bookings,
    })
    .from(bookings)
    .innerJoin(leads, eq(bookings.leadId, leads.id))
    .where(
      and(
        eq(bookings.status, "scheduled"),
        gte(bookings.scheduledAt, now),
        lt(bookings.scheduledAt, oneWeekOut),
      ),
    )
    .orderBy(asc(bookings.scheduledAt));

  const seen = new Set<string>();
  const calls: LeadRow[] = [];
  for (const r of rows) {
    if (seen.has(r.lead.id)) continue;
    seen.add(r.lead.id);
    calls.push({
      id: r.lead.id,
      firstName: r.lead.firstName,
      lastName: r.lead.lastName,
      email: r.lead.email,
      packageInterest: r.lead.packageInterest,
      stageId: r.lead.stageId,
      createdAt: r.lead.createdAt,
      updatedAt: r.lead.updatedAt,
      notes: r.lead.notes,
      phone: r.lead.phone,
      upcomingBookingAt: r.booking.scheduledAt,
      nextEmailName: null,
      nextEmailSendAt: null,
    });
  }

  const detail = sp.lead ? await loadLeadDetail(sp.lead) : null;

  return (
    <>
      <CallsView calls={calls} />
      <LeadDetailModal open={!!detail} leadId={detail?.lead.id ?? null}>
        {detail && <LeadDetailContent data={detail} />}
      </LeadDetailModal>
    </>
  );
}
