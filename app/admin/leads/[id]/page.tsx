import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadDetailContent } from "@/components/admin/lead-detail-content";
import { loadLeadDetail } from "@/lib/admin/lead-detail";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadLeadDetail(id);
  if (!detail) notFound();

  return (
    <div className="flex-1 overflow-auto px-6 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/admin"
          className="font-heading text-xs uppercase tracking-[0.12em] text-(--adm-text-muted) hover:text-gold"
        >
          ← Back to inbox
        </Link>
        <LeadDetailContent data={detail} />
      </div>
    </div>
  );
}
