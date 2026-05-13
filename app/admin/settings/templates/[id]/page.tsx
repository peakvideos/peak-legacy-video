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
    <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <div>
        <Link
          href="/admin/settings/templates"
          className="text-xs font-heading uppercase tracking-[0.14em] text-tofino hover:text-forest"
        >
          ← All templates
        </Link>
      </div>
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
    </main>
  );
}
