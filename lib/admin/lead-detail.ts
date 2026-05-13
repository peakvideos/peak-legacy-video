import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, emailJobs, emailTemplates, leads } from "@/lib/db/schema";
import type { EmailJobWithTemplate, LeadDetail } from "./lead-detail-types";

export async function loadLeadDetail(leadId: string): Promise<LeadDetail | null> {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) return null;

  const [leadBookings, leadJobs] = await Promise.all([
    db
      .select()
      .from(bookings)
      .where(eq(bookings.leadId, leadId))
      .orderBy(desc(bookings.scheduledAt)),
    db
      .select({
        id: emailJobs.id,
        leadId: emailJobs.leadId,
        templateId: emailJobs.templateId,
        sendAt: emailJobs.sendAt,
        sentAt: emailJobs.sentAt,
        status: emailJobs.status,
        attempts: emailJobs.attempts,
        lastError: emailJobs.lastError,
        messageId: emailJobs.messageId,
        createdAt: emailJobs.createdAt,
        updatedAt: emailJobs.updatedAt,
        templateName: emailTemplates.name,
        templateSubject: emailTemplates.subject,
        templateSlug: emailTemplates.slug,
      })
      .from(emailJobs)
      .innerJoin(emailTemplates, eq(emailJobs.templateId, emailTemplates.id))
      .where(eq(emailJobs.leadId, leadId))
      .orderBy(asc(emailJobs.sendAt)),
  ]);

  const enrichedJobs: EmailJobWithTemplate[] = leadJobs;
  const nextEmailJob = enrichedJobs.find((j) => j.status === "pending") ?? null;
  const upcomingBooking =
    leadBookings.find(
      (b) => b.status === "scheduled" && b.scheduledAt.getTime() >= Date.now(),
    ) ?? null;

  return {
    lead,
    bookings: leadBookings,
    emailJobs: enrichedJobs,
    nextEmailJob,
    upcomingBooking,
  };
}
