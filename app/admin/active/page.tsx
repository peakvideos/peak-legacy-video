import { ActiveLeadsTable } from "@/components/admin/active-leads-table";
import { LeadDetailModal } from "@/components/admin/lead-detail-modal";
import { LeadDetailContent } from "@/components/admin/lead-detail-content";
import { loadActiveLeadRows } from "@/lib/admin/lead-rows";
import { loadLeadDetail } from "@/lib/admin/lead-detail";

export const dynamic = "force-dynamic";

export default async function ActiveLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const sp = await searchParams;
  const [rows, detail] = await Promise.all([
    loadActiveLeadRows(),
    sp.lead ? loadLeadDetail(sp.lead) : null,
  ]);

  return (
    <>
      <ActiveLeadsTable rows={rows} />
      <LeadDetailModal open={!!detail} leadId={detail?.lead.id ?? null}>
        {detail && <LeadDetailContent data={detail} />}
      </LeadDetailModal>
    </>
  );
}
