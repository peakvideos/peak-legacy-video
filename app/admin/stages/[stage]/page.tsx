import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailTemplates, stageAutomations, stages } from "@/lib/db/schema";
import { listTemplates } from "@/lib/admin/templates";
import { StageAutomationsEditor } from "./stage-automations-editor";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StagePage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage: stageId } = await params;
  if (!UUID_RE.test(stageId)) {
    notFound();
  }

  const [stage] = await db
    .select()
    .from(stages)
    .where(eq(stages.id, stageId))
    .limit(1);
  if (!stage) {
    notFound();
  }

  const [automations, templates] = await Promise.all([
    db
      .select({
        id: stageAutomations.id,
        templateId: stageAutomations.templateId,
        delayMinutes: stageAutomations.delayMinutes,
        position: stageAutomations.position,
        templateName: emailTemplates.name,
        templateSubject: emailTemplates.subject,
        templateSlug: emailTemplates.slug,
        templateArchivedAt: emailTemplates.archivedAt,
      })
      .from(stageAutomations)
      .innerJoin(
        emailTemplates,
        eq(stageAutomations.templateId, emailTemplates.id),
      )
      .where(eq(stageAutomations.stageId, stage.id))
      .orderBy(asc(stageAutomations.position)),
    listTemplates({ archived: false }),
  ]);

  // Templates that aren't already attached to this stage are eligible to be
  // added.
  const attachedTemplateIds = new Set(automations.map((a) => a.templateId));
  const availableTemplates = templates
    .filter((t) => !attachedTemplateIds.has(t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
      slug: t.slug,
    }));

  return (
    <div className="flex-1 overflow-auto px-6 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/admin/boards"
          className="text-xs font-heading uppercase tracking-[0.14em] text-(--adm-text-muted) hover:text-(--adm-text)"
        >
          ← Boards
        </Link>
        <header>
          <h1 className="text-(--adm-text) text-2xl mb-1">{stage.name}</h1>
          <p className="text-(--adm-text-muted) text-xs">
            Emails queued automatically when a lead enters this stage. Delay is
            measured from the moment they enter.
          </p>
        </header>

      <StageAutomationsEditor
        stage={stage.id}
        automations={automations.map((a) => ({
          id: a.id,
          templateId: a.templateId,
          delayMinutes: a.delayMinutes,
          templateName: a.templateName,
          templateSubject: a.templateSubject,
          templateSlug: a.templateSlug,
        }))}
        availableTemplates={availableTemplates}
      />

        <p className="text-xs text-(--adm-text-muted)">
          When a lead changes stage, queued automations are cancelled and the
          new stage&apos;s automations are queued — except for any template
          that has already been sent to this lead, which is skipped.
        </p>
      </div>
    </div>
  );
}
