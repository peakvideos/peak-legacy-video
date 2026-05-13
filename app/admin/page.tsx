import { InboxList } from "@/components/admin/inbox-list";
import { LeadDetailModal } from "@/components/admin/lead-detail-modal";
import { LeadDetailContent } from "@/components/admin/lead-detail-content";
import { loadInboxEvents } from "@/lib/admin/inbox-events";
import { loadLeadDetail } from "@/lib/admin/lead-detail";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const sp = await searchParams;
  const [events, detail] = await Promise.all([
    loadInboxEvents(),
    sp.lead ? loadLeadDetail(sp.lead) : null,
  ]);

  return (
    <>
      <InboxList events={events} />
      <LeadDetailModal open={!!detail} leadId={detail?.lead.id ?? null}>
        {detail && <LeadDetailContent data={detail} />}
      </LeadDetailModal>
    </>
  );
}
