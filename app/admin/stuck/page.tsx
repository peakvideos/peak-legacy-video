import { StuckView } from "@/components/admin/stuck-view";
import { LeadDetailModal } from "@/components/admin/lead-detail-modal";
import { LeadDetailContent } from "@/components/admin/lead-detail-content";
import { loadLeadDetail } from "@/lib/admin/lead-detail";
import { loadStuckLeadRows } from "@/lib/admin/lead-rows";
import { getSettings } from "@/lib/stages/settings";

export const dynamic = "force-dynamic";

export default async function StuckPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const sp = await searchParams;
  const [rows, { coldThresholdDays }, detail] = await Promise.all([
    loadStuckLeadRows(),
    getSettings(),
    sp.lead ? loadLeadDetail(sp.lead) : null,
  ]);

  return (
    <>
      <StuckView rows={rows} coldThresholdDays={coldThresholdDays} />
      <LeadDetailModal open={!!detail} leadId={detail?.lead.id ?? null}>
        {detail && <LeadDetailContent data={detail} />}
      </LeadDetailModal>
    </>
  );
}
