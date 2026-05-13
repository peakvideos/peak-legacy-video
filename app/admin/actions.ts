"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailJobs, emailTemplates, leads } from "@/lib/db/schema";
import {
  transitionLeadStageAutomations,
  type LeadStage,
} from "@/lib/email/sequence";
import { sendStoredTemplateEmail } from "@/lib/email";
import { unsubscribeUrlFor } from "@/lib/email/unsubscribe";
import { isNull } from "drizzle-orm";

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function setLeadStage(leadId: string, stage: LeadStage) {
  await requireSession();

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ stage: leads.stage })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    if (!current) {
      throw new Error("Lead not found");
    }

    await tx
      .update(leads)
      .set({ stage, updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    if (current.stage === stage) {
      // No-op transition — leave queued jobs alone.
      return;
    }

    await transitionLeadStageAutomations(leadId, stage, { tx });
  });

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
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
  revalidatePath("/admin/sequences");
}
