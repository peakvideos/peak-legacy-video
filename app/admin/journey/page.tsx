import Link from "next/link";
import { loadJourney, type JourneyCard } from "@/lib/admin/journey";
import { formatDelayPhrase } from "@/lib/admin/delay";
import { stagePalette } from "@/lib/admin/stages";

export const dynamic = "force-dynamic";

export default async function JourneyPage() {
  const journey = await loadJourney();

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
          <section
            key={stage.id}
            id={`stage-${stage.id}`}
            className={`flex flex-col bg-(--adm-surface-2) border-t-2 min-w-[260px] w-[260px] shrink-0 scroll-mt-6 ${stagePalette(stage.color).tone}`}
          >
            <header className="flex items-center justify-between px-3 py-2.5 border-b border-(--adm-border)">
              <h2 className="font-heading text-[0.72rem] uppercase tracking-[0.12em] text-(--adm-text) truncate">
                {stage.name}
              </h2>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-heading text-xs text-(--adm-text-muted)">
                  {stage.automations.length}
                </span>
                <Link
                  href={`/admin/stages/${stage.id}`}
                  className="text-(--adm-text-muted) hover:text-gold text-base leading-none"
                  title={`Edit ${stage.name} automations`}
                >
                  ⚙
                </Link>
              </div>
            </header>
            <div className="flex-1 px-2 py-2 space-y-2 min-h-[120px]">
              {stage.automations.length === 0 ? (
                <p className="text-xs text-(--adm-text-muted) text-center px-3 py-6">
                  No automated emails.
                </p>
              ) : (
                stage.automations.map((card) => (
                  <AutomationCard key={card.id} card={card} />
                ))
              )}
            </div>
          </section>
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

function AutomationCard({ card }: { card: JourneyCard }) {
  return (
    <div className="bg-(--adm-surface) border border-(--adm-border) px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-(--adm-text) truncate">
          {card.templateName}
        </p>
        <p className="font-heading text-[0.65rem] uppercase tracking-[0.1em] text-gold shrink-0">
          {formatDelayPhrase(card.delayMinutes)}
        </p>
      </div>
      <p className="text-xs text-(--adm-text-muted) truncate">
        {card.templateSubject}
      </p>
    </div>
  );
}
