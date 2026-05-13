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
    <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-(--adm-text) text-2xl mb-1">Email templates</h1>
          <p className="text-(--adm-text-muted) text-xs">
            Edit subject, body, and merge variables. Templates are referenced
            by stage automations.
          </p>
        </div>
        <CreateTemplateForm />
      </header>

      <section className="space-y-2">
        <h2 className="font-heading uppercase tracking-[0.14em] text-xs text-(--adm-text-muted)">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="bg-(--adm-surface) border border-(--adm-border) p-6 text-sm text-(--adm-text-muted)">
            No templates yet. Create one to get started.
          </p>
        ) : (
          <ul className="bg-(--adm-surface) border border-(--adm-border) divide-y divide-(--adm-border)">
            {active.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/settings/templates/${t.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-(--adm-hover)"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-(--adm-text) text-sm">{t.name}</p>
                    <p className="text-(--adm-text-muted) text-xs truncate">{t.subject}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-(--adm-text-muted) text-xs font-mono">
                      {t.slug}
                    </p>
                    <p className="text-(--adm-text-muted) opacity-70 text-xs">
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
          <h2 className="font-heading uppercase tracking-[0.14em] text-xs text-(--adm-text-muted)">
            Archived ({archived.length})
          </h2>
          <ul className="bg-(--adm-surface) border border-(--adm-border) divide-y divide-(--adm-border) opacity-70">
            {archived.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/settings/templates/${t.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-(--adm-hover)"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-(--adm-text) text-sm">
                      {t.name}
                    </p>
                    <p className="text-(--adm-text-muted) text-xs truncate">{t.subject}</p>
                  </div>
                  <p className="text-(--adm-text-muted) text-xs font-heading uppercase tracking-[0.14em]">
                    Archived
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
