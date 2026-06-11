import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailJobs, emailTemplates, leads } from "@/lib/db/schema";

export type OutboxRow = {
  id: string;
  leadId: string;
  recipientName: string;
  recipientEmail: string;
  templateId: string;
  templateName: string;
  templateSubject: string;
  sendAt: Date;
  attempts: number;
};

/**
 * Everything the system is about to do: all pending email jobs across all
 * leads, in send order.
 */
export async function loadOutboxPending(): Promise<OutboxRow[]> {
  const rows = await db
    .select({
      id: emailJobs.id,
      leadId: emailJobs.leadId,
      firstName: leads.firstName,
      lastName: leads.lastName,
      recipientEmail: leads.email,
      templateId: emailJobs.templateId,
      templateName: emailTemplates.name,
      templateSubject: emailTemplates.subject,
      sendAt: emailJobs.sendAt,
      attempts: emailJobs.attempts,
    })
    .from(emailJobs)
    .innerJoin(leads, eq(emailJobs.leadId, leads.id))
    .innerJoin(emailTemplates, eq(emailJobs.templateId, emailTemplates.id))
    .where(eq(emailJobs.status, "pending"))
    .orderBy(asc(emailJobs.sendAt));

  return rows.map(({ firstName, lastName, ...row }) => ({
    ...row,
    recipientName: `${firstName} ${lastName}`,
  }));
}

export type OutboxSentRow = {
  id: string;
  leadId: string;
  recipientName: string;
  recipientEmail: string;
  templateId: string;
  templateName: string;
  templateSubject: string;
  status: "sent" | "failed";
  /** When it happened: send time for sent jobs, last attempt for failed. */
  at: Date;
  attempts: number;
  lastError: string | null;
};

const SENT_LIMIT = 200;

/**
 * Everything the system has done: sent and failed jobs on one timeline,
 * newest first. Failed jobs surface their last SMTP error so the history
 * doubles as the failure log.
 */
export async function loadOutboxSent(): Promise<OutboxSentRow[]> {
  // Sent jobs have a sentAt; failed jobs are terminal, so their updatedAt
  // is the time of the final attempt.
  const happenedAt = sql<Date>`coalesce(${emailJobs.sentAt}, ${emailJobs.updatedAt})`;

  const rows = await db
    .select({
      id: emailJobs.id,
      leadId: emailJobs.leadId,
      firstName: leads.firstName,
      lastName: leads.lastName,
      recipientEmail: leads.email,
      templateId: emailJobs.templateId,
      templateName: emailTemplates.name,
      templateSubject: emailTemplates.subject,
      status: emailJobs.status,
      at: happenedAt,
      attempts: emailJobs.attempts,
      lastError: emailJobs.lastError,
    })
    .from(emailJobs)
    .innerJoin(leads, eq(emailJobs.leadId, leads.id))
    .innerJoin(emailTemplates, eq(emailJobs.templateId, emailTemplates.id))
    .where(inArray(emailJobs.status, ["sent", "failed"]))
    .orderBy(desc(happenedAt))
    .limit(SENT_LIMIT);

  return rows.map(({ firstName, lastName, status, at, ...row }) => ({
    ...row,
    status: status as "sent" | "failed",
    at: new Date(at),
    recipientName: `${firstName} ${lastName}`,
  }));
}
