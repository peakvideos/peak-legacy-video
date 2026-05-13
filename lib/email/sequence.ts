import "server-only";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailJobs, leads, stageAutomations } from "@/lib/db/schema";

export type LeadStage =
  | "new"
  | "stale"
  | "booked_a_call"
  | "call_completed"
  | "video_shoot_scheduled"
  | "post_video_shoot"
  | "closed"
  | "lost";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Schedules every automation configured for `stage` for this lead, anchored
 * to `from`. Skips any template that has already been delivered (status =
 * `sent`) so re-entering a stage doesn't duplicate emails. Cancelled prior
 * jobs don't count — those represent attempts we never delivered.
 */
export async function enqueueAutomationsForStage(
  leadId: string,
  stage: LeadStage,
  options: { from?: Date; tx?: Tx } = {},
): Promise<{ enqueued: number; skipped: number }> {
  const runner = options.tx ?? db;
  const from = options.from ?? new Date();

  const automations = await runner
    .select({
      templateId: stageAutomations.templateId,
      delayMinutes: stageAutomations.delayMinutes,
    })
    .from(stageAutomations)
    .where(eq(stageAutomations.stage, stage))
    .orderBy(stageAutomations.position);

  if (automations.length === 0) {
    return { enqueued: 0, skipped: 0 };
  }

  // Find templates that have already been sent or are currently pending for
  // this lead. We don't want to re-queue those.
  const blockingJobs = await runner
    .select({ templateId: emailJobs.templateId })
    .from(emailJobs)
    .where(
      and(
        eq(emailJobs.leadId, leadId),
        inArray(emailJobs.status, ["pending", "sent"]),
      ),
    );
  const blockingTemplateIds = new Set(blockingJobs.map((j) => j.templateId));

  const rows = automations
    .filter((a) => !blockingTemplateIds.has(a.templateId))
    .map((a) => ({
      leadId,
      templateId: a.templateId,
      sendAt: new Date(from.getTime() + a.delayMinutes * 60_000),
    }));

  if (rows.length === 0) {
    return { enqueued: 0, skipped: automations.length };
  }

  await runner.insert(emailJobs).values(rows);
  return {
    enqueued: rows.length,
    skipped: automations.length - rows.length,
  };
}

/** Marks any pending email_jobs for the lead as cancelled. */
export async function cancelPendingForLead(
  leadId: string,
  options: { tx?: Tx } = {},
): Promise<void> {
  const runner = options.tx ?? db;
  await runner
    .update(emailJobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(eq(emailJobs.leadId, leadId), eq(emailJobs.status, "pending")),
    );
}

/**
 * When a lead changes stage, cancel anything queued and queue the new
 * stage's automations. This is the central effect of moving a card on the
 * kanban.
 */
export async function transitionLeadStageAutomations(
  leadId: string,
  newStage: LeadStage,
  options: { tx?: Tx; from?: Date } = {},
): Promise<{ enqueued: number; skipped: number; cancelled: number }> {
  const runner = options.tx ?? db;

  const cancelResult = await runner
    .update(emailJobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(eq(emailJobs.leadId, leadId), eq(emailJobs.status, "pending")),
    )
    .returning({ id: emailJobs.id });

  const enqueueResult = await enqueueAutomationsForStage(
    leadId,
    newStage,
    options,
  );

  return {
    cancelled: cancelResult.length,
    enqueued: enqueueResult.enqueued,
    skipped: enqueueResult.skipped,
  };
}

/**
 * After a stage's automation list is edited, cancel any pending email_jobs
 * for leads currently in that stage whose template_id is no longer attached
 * to the stage. Called from the automation editor server action.
 */
export async function reconcileAutomationsForStage(
  stage: LeadStage,
  options: { tx?: Tx } = {},
): Promise<{ cancelled: number }> {
  const runner = options.tx ?? db;

  const remaining = await runner
    .select({ templateId: stageAutomations.templateId })
    .from(stageAutomations)
    .where(eq(stageAutomations.stage, stage));
  const remainingIds = remaining.map((r) => r.templateId);

  // Find lead ids currently in this stage so we can scope the cancellation.
  const leadsInStage = await runner
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.stage, stage));
  const leadIds = leadsInStage.map((l) => l.id);

  if (leadIds.length === 0) {
    return { cancelled: 0 };
  }

  const baseFilter = and(
    eq(emailJobs.status, "pending"),
    inArray(emailJobs.leadId, leadIds),
  );
  const filter =
    remainingIds.length === 0
      ? baseFilter
      : and(baseFilter, notInArray(emailJobs.templateId, remainingIds));

  const result = await runner
    .update(emailJobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(filter)
    .returning({ id: emailJobs.id });

  return { cancelled: result.length };
}

// Touch the imports we keep around for typing/eslint consistency.
void sql;
