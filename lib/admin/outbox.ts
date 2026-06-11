import "server-only";
import { asc, eq } from "drizzle-orm";
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
