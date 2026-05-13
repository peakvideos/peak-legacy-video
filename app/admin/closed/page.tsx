import { ClosedLeads } from "@/components/admin/closed-leads";
import { LeadDetailModal } from "@/components/admin/lead-detail-modal";
import { LeadDetailContent } from "@/components/admin/lead-detail-content";
import { loadClosedLeadRows } from "@/lib/admin/lead-rows";
import { loadLeadDetail } from "@/lib/admin/lead-detail";

export const dynamic = "force-dynamic";

export default async function ClosedPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const sp = await searchParams;
  const [paid, lost, detail] = await Promise.all([
    loadClosedLeadRows("closed"),
    loadClosedLeadRows("lost"),
    sp.lead ? loadLeadDetail(sp.lead) : null,
  ]);

  return (
    <>
      <ClosedLeads paid={paid} lost={lost} />
      <LeadDetailModal open={!!detail} leadId={detail?.lead.id ?? null}>
        {detail && <LeadDetailContent data={detail} />}
      </LeadDetailModal>
    </>
  );
}
