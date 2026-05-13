import { and, desc, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { StuckView } from "@/components/admin/stuck-view";
import { LeadDetailModal } from "@/components/admin/lead-detail-modal";
import { LeadDetailContent } from "@/components/admin/lead-detail-content";
import { loadLeadDetail } from "@/lib/admin/lead-detail";
import type { LeadRow } from "@/lib/admin/lead-rows";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function StuckPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const sp = await searchParams;
  const fourteenDaysAgo = new Date(Date.now() - 14 * DAY_MS);

  const rows = await db
    .select()
    .from(leads)
    .where(
      and(
        ne(leads.stage, "closed"),
        ne(leads.stage, "lost"),
        lt(leads.updatedAt, fourteenDaysAgo),
      ),
    )
    .orderBy(desc(leads.updatedAt));

  const mapped: LeadRow[] = rows.map((l) => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email,
    packageInterest: l.packageInterest,
    stage: l.stage,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    notes: l.notes,
    phone: l.phone,
    upcomingBookingAt: null,
    nextEmailName: null,
    nextEmailSendAt: null,
  }));

  const detail = sp.lead ? await loadLeadDetail(sp.lead) : null;

  return (
    <>
      <StuckView rows={mapped} />
      <LeadDetailModal open={!!detail} leadId={detail?.lead.id ?? null}>
        {detail && <LeadDetailContent data={detail} />}
      </LeadDetailModal>
    </>
  );
}
