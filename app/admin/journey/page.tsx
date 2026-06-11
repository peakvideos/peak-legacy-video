import Link from "next/link";
import { loadJourney } from "@/lib/admin/journey";
import { listTemplates } from "@/lib/admin/templates";
import { stagePalette } from "@/lib/admin/stages";
import { JourneyStageColumn } from "./journey-stage-column";

export const dynamic = "force-dynamic";

export default async function JourneyPage() {
  const [journey, activeTemplates] = await Promise.all([
    loadJourney(),
    listTemplates({ archived: false }),
  ]);
  const templates = activeTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
  }));

  return (
    <div className="flex-1 overflow-auto px-6 py-6">
      <header className="mb-5">
        <h1 className="text-(--adm-text) text-2xl mb-1">Journey</h1>
        <p className="text-(--adm-text-muted) text-xs">
          Every email a lead gets, stage by stage. Delays count from the
          moment a lead enters the stage.
        </p>
      </header>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {journey.stages.map((stage) => (
          <JourneyStageColumn
            key={stage.id}
            stage={{ id: stage.id, name: stage.name }}
            cards={stage.automations}
            templates={templates}
            toneClass={stagePalette(stage.color).tone}
          />
        ))}
      </div>

      <section className="mt-6">
        <h2 className="font-heading text-[0.72rem] uppercase tracking-[0.12em] text-(--adm-text-muted) mb-2">
          Unattached templates · {journey.unattached.length}
        </h2>
        {journey.unattached.length === 0 ? (
          <p className="text-xs text-(--adm-text-muted)">
            Every template is attached to a stage.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {journey.unattached.map((t) => (
              <Link
                key={t.id}
                href={`/admin/settings/templates/${t.id}`}
                className="block w-[260px] bg-(--adm-surface) border border-(--adm-border) px-3 py-2.5 hover:border-gold"
              >
                <p className="text-sm text-(--adm-text) truncate">{t.name}</p>
                <p className="text-xs text-(--adm-text-muted) truncate">
                  {t.subject}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
