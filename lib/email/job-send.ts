import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  emailJobs,
  emailTemplates,
  leads,
  stageAutomations,
} from "@/lib/db/schema";
import { sendStoredTemplateEmail } from "@/lib/email";
import { renderTemplate } from "./template-render";
import { unsubscribeUrlFor } from "./unsubscribe";
import type { LeadVariableInput } from "./variables";

/**
 * The exact variable set a stored-template email is rendered against at
 * send time. Preview and send must build this identically — that is what
 * makes the outbox preview trustworthy.
 */
export function jobLeadVariables(lead: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  packageInterest: "legacy" | "heirloom" | "unsure";
}): LeadVariableInput {
  return {
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    packageInterest: lead.packageInterest,
    bookingUrl: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    unsubscribeUrl: unsubscribeUrlFor(lead.id),
  };
}

async function loadJob(jobId: string) {
  const [row] = await db
    .select({
      jobId: emailJobs.id,
      status: emailJobs.status,
      attempts: emailJobs.attempts,
      templateId: emailJobs.templateId,
      leadId: leads.id,
      firstName: leads.firstName,
      lastName: leads.lastName,
      email: leads.email,
      packageInterest: leads.packageInterest,
      stageId: leads.stageId,
      unsubscribedAt: leads.unsubscribedAt,
      templateSubject: emailTemplates.subject,
      templateBody: emailTemplates.body,
      templateArchivedAt: emailTemplates.archivedAt,
    })
    .from(emailJobs)
    .innerJoin(leads, eq(emailJobs.leadId, leads.id))
    .innerJoin(emailTemplates, eq(emailJobs.templateId, emailTemplates.id))
    .where(eq(emailJobs.id, jobId))
    .limit(1);
  if (!row) {
    throw new Error("Email job not found.");
  }
  return row;
}

/**
 * Renders an email job exactly as the send worker will: same template, same
 * lead variables, same wrapper and unsubscribe footer.
 */
export async function renderEmailJob(jobId: string): Promise<{
  to: string;
  subject: string;
  html: string;
  text: string;
}> {
  const job = await loadJob(jobId);
  const rendered = renderTemplate({
    subject: job.templateSubject,
    body: job.templateBody,
    lead: jobLeadVariables({
      id: job.leadId,
      firstName: job.firstName,
      lastName: job.lastName,
      email: job.email,
      packageInterest: job.packageInterest,
    }),
  });
  return { to: job.email, ...rendered };
}

export type JobSendResult = {
  outcome: "sent" | "cancelled" | "retried" | "failed";
  error?: string;
};

export const MAX_ATTEMPTS = 5;
const RETRY_BACKOFF_MIN = [1, 5, 30, 120, 360]; // minutes per attempt

/**
 * Sends one email job through the normal send path and records the result
 * on the job row: the single pipeline behind both the cron worker and the
 * outbox's "Send now".
 */
export async function processEmailJob(jobId: string): Promise<JobSendResult> {
  const job = await loadJob(jobId);
  if (job.status !== "pending") {
    throw new Error("Job is not pending — only queued emails can be sent.");
  }

  // If the lead unsubscribed, cancel and move on — no email goes out.
  if (job.unsubscribedAt) {
    await db
      .update(emailJobs)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(emailJobs.id, job.jobId));
    return { outcome: "cancelled", error: "Lead has unsubscribed." };
  }

  // If the template has been archived, or the lead's current stage no
  // longer has this template attached as an automation, cancel the job.
  // This keeps in-flight queues consistent with the latest config.
  const stillRelevant = await isJobStillRelevant({
    stageId: job.stageId,
    templateId: job.templateId,
    templateArchived: job.templateArchivedAt != null,
  });
  if (!stillRelevant) {
    await db
      .update(emailJobs)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(emailJobs.id, job.jobId));
    return {
      outcome: "cancelled",
      error: "Template is archived or no longer attached to the lead's stage.",
    };
  }

  const result = await sendStoredTemplateEmail({
    template: { subject: job.templateSubject, body: job.templateBody },
    to: job.email,
    lead: jobLeadVariables({
      id: job.leadId,
      firstName: job.firstName,
      lastName: job.lastName,
      email: job.email,
      packageInterest: job.packageInterest,
    }),
  });

  if (result.ok) {
    await db
      .update(emailJobs)
      .set({
        status: "sent",
        sentAt: new Date(),
        messageId: result.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(emailJobs.id, job.jobId));
    return { outcome: "sent" };
  }

  // Failure path — backoff and retry, or give up after MAX_ATTEMPTS.
  const error = result.error?.slice(0, 1000) ?? "unknown";
  const nextAttempts = job.attempts + 1;
  if (nextAttempts >= MAX_ATTEMPTS) {
    await db
      .update(emailJobs)
      .set({
        status: "failed",
        attempts: nextAttempts,
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(emailJobs.id, job.jobId));
    return { outcome: "failed", error };
  }

  const backoffMin =
    RETRY_BACKOFF_MIN[Math.min(nextAttempts, RETRY_BACKOFF_MIN.length - 1)];
  await db
    .update(emailJobs)
    .set({
      attempts: nextAttempts,
      sendAt: new Date(Date.now() + backoffMin * 60_000),
      lastError: error,
      updatedAt: new Date(),
    })
    .where(eq(emailJobs.id, job.jobId));
  return { outcome: "retried", error };
}

async function isJobStillRelevant(args: {
  stageId: string;
  templateId: string;
  templateArchived: boolean;
}): Promise<boolean> {
  if (args.templateArchived) return false;
  const [match] = await db
    .select({ id: stageAutomations.id })
    .from(stageAutomations)
    .where(
      and(
        eq(stageAutomations.stageId, args.stageId),
        eq(stageAutomations.templateId, args.templateId),
      ),
    )
    .limit(1);
  return !!match;
}
