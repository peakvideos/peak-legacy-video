import Link from "next/link";
import { listTemplates } from "@/lib/admin/templates";
import { CreateTemplateForm } from "./create-template-form";

export const dynamic = "force-dynamic";

const updatedFmt = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function TemplatesPage() {
  const templates = await listTemplates();
  const active = templates.filter((t) => !t.archivedAt);
  const archived = templates.filter((t) => t.archivedAt);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-forest text-3xl mb-1">Email templates</h1>
          <p className="text-tofino italic text-sm">
            Edit subject, body, and merge variables. Templates are referenced
            by stage automations.
          </p>
        </div>
        <CreateTemplateForm />
      </header>

      <section className="space-y-2">
        <h2 className="font-heading uppercase tracking-[0.14em] text-xs text-tofino">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="bg-white border border-forest/10 p-6 text-sm text-tofino italic">
            No templates yet. Create one to get started.
          </p>
        ) : (
          <ul className="bg-white border border-forest/10 divide-y divide-forest/10">
            {active.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/settings/templates/${t.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-off-white"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-forest text-sm">{t.name}</p>
                    <p className="text-tofino text-xs truncate">{t.subject}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-tofino text-xs font-heading uppercase tracking-wider">
                      {t.slug}
                    </p>
                    <p className="text-tofino/70 text-xs">
                      Updated {updatedFmt.format(t.updatedAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading uppercase tracking-[0.14em] text-xs text-tofino">
            Archived ({archived.length})
          </h2>
          <ul className="bg-white border border-forest/10 divide-y divide-forest/10 opacity-70">
            {archived.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/settings/templates/${t.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-off-white"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-forest text-sm">
                      {t.name}
                    </p>
                    <p className="text-tofino text-xs truncate">{t.subject}</p>
                  </div>
                  <p className="text-tofino text-xs font-heading uppercase tracking-wider">
                    Archived
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
