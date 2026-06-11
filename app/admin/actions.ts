"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailJobs, emailTemplates, leads, stages } from "@/lib/db/schema";
import { transitionLeadStageAutomations } from "@/lib/email/sequence";
import { sendStoredTemplateEmail } from "@/lib/email";
import {
  processEmailJob,
  renderEmailJob,
  type JobSendResult,
} from "@/lib/email/job-send";
import { unsubscribeUrlFor } from "@/lib/email/unsubscribe";
import { updateSettings } from "@/lib/stages/settings";
import { isNull } from "drizzle-orm";

/**
 * What a stage move did, in the shape the move toast needs: counts for the
 * summary line plus everything `undoLeadStageMove` needs to reverse it.
 */
export type StageMoveResult = {
  fromStageId: string;
  cancelled: number;
  scheduled: number;
  cancelledJobIds: string[];
  scheduledJobIds: string[];
};

export async function setLeadStage(
  leadId: string,
  stageId: string,
): Promise<StageMoveResult> {
  await requireSession();

  const result = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: stages.id })
      .from(stages)
      .where(eq(stages.id, stageId))
      .limit(1);
    if (!target) {
      throw new Error("Unknown stage");
    }

    const [current] = await tx
      .select({ stageId: leads.stageId })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    if (!current) {
      throw new Error("Lead not found");
    }

    await tx
      .update(leads)
      .set({ stageId, updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    if (current.stageId === stageId) {
      // No-op transition — leave queued jobs alone.
      return {
        fromStageId: current.stageId,
        cancelled: 0,
        scheduled: 0,
        cancelledJobIds: [],
        scheduledJobIds: [],
      };
    }

    const transition = await transitionLeadStageAutomations(leadId, stageId, {
      tx,
    });
    return {
      fromStageId: current.stageId,
      cancelled: transition.cancelled,
      scheduled: transition.enqueued,
      cancelledJobIds: transition.cancelledJobIds,
      scheduledJobIds: transition.enqueuedJobIds,
    };
  });

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
  return result;
}

/**
 * Reverses a stage move from the toast's Undo: puts the lead back on the
 * stage it left. Takes the `StageMoveResult` the move returned.
 */
export async function undoLeadStageMove(leadId: string, move: StageMoveResult) {
  await requireSession();

  await db.transaction(async (tx) => {
    await tx
      .update(leads)
      .set({ stageId: move.fromStageId, updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    if (move.cancelledJobIds.length > 0) {
      // The cancel only flipped status — send_at was never touched, so
      // flipping back restores the original send times.
      await tx
        .update(emailJobs)
        .set({ status: "pending", updatedAt: new Date() })
        .where(
          and(
            eq(emailJobs.leadId, leadId),
            inArray(emailJobs.id, move.cancelledJobIds),
            eq(emailJobs.status, "cancelled"),
          ),
        );
    }

    if (move.scheduledJobIds.length > 0) {
      // Only still-pending rows: a zero-delay job the worker already
      // drained is sent history, and history is never rewritten.
      await tx
        .delete(emailJobs)
        .where(
          and(
            eq(emailJobs.leadId, leadId),
            inArray(emailJobs.id, move.scheduledJobIds),
            eq(emailJobs.status, "pending"),
          ),
        );
    }
  });

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/outbox");
}

export async function setLeadCrmNotes(leadId: string, crmNotes: string) {
  await requireSession();

  const trimmed = crmNotes.trim();
  await db
    .update(leads)
    .set({ crmNotes: trimmed.length > 0 ? trimmed : null, updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
}

/**
 * Returns the active (non-archived) email templates so the one-off
 * composer can offer them as starting points.
 */
export async function listActiveTemplatesForComposer() {
  await requireSession();
  const rows = await db
    .select({
      id: emailTemplates.id,
      name: emailTemplates.name,
      subject: emailTemplates.subject,
      body: emailTemplates.body,
    })
    .from(emailTemplates)
    .where(isNull(emailTemplates.archivedAt));
  return rows;
}

/**
 * Sends a one-off email to a specific lead. Body is rendered server-side
 * with the lead's variables. Not recorded in `email_jobs` — owner sees the
 * outbound copy in their Gmail Sent folder if they need an audit trail.
 */
export async function sendOneOffEmailToLead(args: {
  leadId: string;
  subject: string;
  body: unknown;
}) {
  await requireSession();
  const subject = args.subject.trim();
  if (!subject) {
    return { ok: false, error: "Subject is required." };
  }

  const [lead] = await db
    .select({
      firstName: leads.firstName,
      lastName: leads.lastName,
      email: leads.email,
      packageInterest: leads.packageInterest,
      unsubscribedAt: leads.unsubscribedAt,
    })
    .from(leads)
    .where(eq(leads.id, args.leadId))
    .limit(1);
  if (!lead) {
    return { ok: false, error: "Lead not found." };
  }
  if (lead.unsubscribedAt) {
    return {
      ok: false,
      error: "This lead has unsubscribed. Resubscribe them first if intentional.",
    };
  }

  const result = await sendStoredTemplateEmail({
    template: { subject, body: args.body },
    to: lead.email,
    lead: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      packageInterest: lead.packageInterest,
      bookingUrl:
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
      unsubscribeUrl: unsubscribeUrlFor(args.leadId),
    },
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/admin/leads/${args.leadId}`);
  return { ok: true, to: lead.email };
}

/**
 * Marks the lead as unsubscribed (or resubscribes if `value === false`).
 * Cancels any pending email_jobs when unsubscribing so nothing leaks out
 * after the toggle.
 */
export async function setLeadUnsubscribed(leadId: string, value: boolean) {
  await requireSession();

  await db.transaction(async (tx) => {
    await tx
      .update(leads)
      .set({
        unsubscribedAt: value ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    if (value) {
      await tx
        .update(emailJobs)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(eq(emailJobs.leadId, leadId), eq(emailJobs.status, "pending")),
        );
    }
  });

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
}

/**
 * The outbox's global Pause switch. While Paused the send worker attempts
 * no jobs and cancels nothing; held emails (including overdue ones) send on
 * the first run after resume. "Send now" still works — a deliberate
 * per-email override of the brake.
 */
export async function setSendingPaused(paused: boolean) {
  await requireSession();

  await updateSettings({ paused });

  revalidatePath("/admin/outbox");
}

/**
 * Renders an email job for the outbox preview — the exact subject and body
 * the lead will receive, via the same rendering path the send worker uses.
 */
export async function previewEmailJob(jobId: string) {
  await requireSession();
  return renderEmailJob(jobId);
}

/**
 * Sends a queued email job immediately, ahead of its scheduled time. Goes
 * through the same send pipeline as the cron worker, so the result —
 * success, retry backoff, or terminal failure — is recorded identically.
 */
export async function sendEmailJobNow(jobId: string): Promise<JobSendResult> {
  await requireSession();

  const result = await processEmailJob(jobId);

  revalidatePath("/admin/outbox");
  return result;
}

/**
 * Cancels a single queued email_jobs row. Only pending jobs can be
 * cancelled — sent/failed/cancelled rows are no-ops to avoid rewriting
 * history.
 */
export async function cancelEmailJob(jobId: string) {
  await requireSession();

  const result = await db
    .update(emailJobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(emailJobs.id, jobId), eq(emailJobs.status, "pending")))
    .returning({ leadId: emailJobs.leadId });

  if (result.length === 0) {
    throw new Error("Job not pending or not found.");
  }

  revalidatePath(`/admin/leads/${result[0].leadId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/outbox");
}
