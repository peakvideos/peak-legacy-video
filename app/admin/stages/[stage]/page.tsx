import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailTemplates, stageAutomations } from "@/lib/db/schema";
import { listTemplates } from "@/lib/admin/templates";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/admin/stages";
import type { LeadStage } from "@/lib/email/sequence";
import { StageAutomationsEditor } from "./stage-automations-editor";

export const dynamic = "force-dynamic";

export default async function StagePage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage } = await params;
  if (!(STAGE_ORDER as string[]).includes(stage)) {
    notFound();
  }
  const validStage = stage as LeadStage;

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
      .where(eq(stageAutomations.stage, validStage))
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
    <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-xs font-heading uppercase tracking-[0.14em] text-tofino hover:text-forest"
        >
          ← Board
        </Link>
      </div>
      <header>
        <h1 className="text-forest text-3xl mb-1">
          {STAGE_LABELS[validStage]}
        </h1>
        <p className="text-tofino italic text-sm">
          Emails queued automatically when a lead enters this stage. Delay is
          measured from the moment they enter.
        </p>
      </header>

      <StageAutomationsEditor
        stage={validStage}
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

      <p className="text-xs text-tofino">
        When a lead changes stage, queued automations are cancelled and the
        new stage&apos;s automations are queued — except for any template
        that has already been sent to this lead, which is skipped.
      </p>
    </main>
  );
}
