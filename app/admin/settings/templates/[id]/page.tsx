import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/admin/templates";
import { TemplateEditForm } from "./template-edit-form";

export const dynamic = "force-dynamic";

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <div className="flex-1 overflow-auto px-6 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/admin/settings/templates"
          className="text-xs font-heading uppercase tracking-[0.14em] text-(--adm-text-muted) hover:text-(--adm-text)"
        >
          ← All templates
        </Link>
        <TemplateEditForm
          template={{
            id: template.id,
            name: template.name,
            slug: template.slug,
            subject: template.subject,
            body: template.body,
            archivedAt: template.archivedAt,
          }}
        />
      </div>
    </div>
  );
}
