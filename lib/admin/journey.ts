import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailTemplates, stageAutomations } from "@/lib/db/schema";
import { listTemplates } from "@/lib/admin/templates";
import { listStages } from "@/lib/stages";

export type JourneyCard = {
  id: string;
  templateId: string;
  templateName: string;
  templateSubject: string;
  delayMinutes: number;
};

export type JourneyStage = {
  id: string;
  name: string;
  color: string;
  position: number;
  automations: JourneyCard[];
};

export type UnattachedTemplate = {
  id: string;
  name: string;
  subject: string;
};

export type Journey = {
  stages: JourneyStage[];
  unattached: UnattachedTemplate[];
};

/**
 * Every stage in pipeline order with its automations as cards, plus the
 * shelf of active templates no stage sends. Archived templates are excluded
 * from the shelf but keep their card when still attached — the sequencer
 * still enqueues them.
 */
export async function loadJourney(): Promise<Journey> {
  const [stageRows, activeTemplates, automationRows] = await Promise.all([
    listStages(),
    listTemplates({ archived: false }),
    db
      .select({
        id: stageAutomations.id,
        stageId: stageAutomations.stageId,
        templateId: stageAutomations.templateId,
        delayMinutes: stageAutomations.delayMinutes,
        templateName: emailTemplates.name,
        templateSubject: emailTemplates.subject,
      })
      .from(stageAutomations)
      .innerJoin(
        emailTemplates,
        eq(stageAutomations.templateId, emailTemplates.id),
      )
      .orderBy(
        asc(stageAutomations.delayMinutes),
        asc(stageAutomations.position),
      ),
  ]);

  const cardsByStage = new Map<string, JourneyCard[]>();
  for (const row of automationRows) {
    const cards = cardsByStage.get(row.stageId) ?? [];
    cards.push({
      id: row.id,
      templateId: row.templateId,
      templateName: row.templateName,
      templateSubject: row.templateSubject,
      delayMinutes: row.delayMinutes,
    });
    cardsByStage.set(row.stageId, cards);
  }

  const attachedTemplateIds = new Set(
    automationRows.map((row) => row.templateId),
  );

  return {
    stages: stageRows.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      position: s.position,
      automations: cardsByStage.get(s.id) ?? [],
    })),
    unattached: activeTemplates
      .filter((t) => !attachedTemplateIds.has(t.id))
      .map((t) => ({ id: t.id, name: t.name, subject: t.subject })),
  };
}

/** Automations per stage for the board column indicators — every stage present, zeroes included. */
export async function loadAutomationCountsByStage(): Promise<
  Record<string, number>
> {
  const [stageRows, grouped] = await Promise.all([
    listStages(),
    db
      .select({ stageId: stageAutomations.stageId, n: count() })
      .from(stageAutomations)
      .groupBy(stageAutomations.stageId),
  ]);

  const counts = Object.fromEntries(stageRows.map((s) => [s.id, 0]));
  for (const row of grouped) {
    counts[row.stageId] = row.n;
  }
  return counts;
}
