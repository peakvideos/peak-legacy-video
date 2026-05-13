import "server-only";
import { asc, desc, eq, ne, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, emailJobs, emailTemplates, leads } from "@/lib/db/schema";
import type { LeadStage } from "@/lib/admin/stages";
import type { PackageInterest } from "@/components/admin/shared";

export type LeadRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  packageInterest: PackageInterest;
  stage: LeadStage;
  createdAt: Date;
  updatedAt: Date;
  notes: string | null;
  phone: string | null;
  upcomingBookingAt: Date | null;
  nextEmailName: string | null;
  nextEmailSendAt: Date | null;
};

export async function loadActiveLeadRows(): Promise<LeadRow[]> {
  const [allLeads, scheduledBookings, pendingJobs] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(and(ne(leads.stage, "closed"), ne(leads.stage, "lost")))
      .orderBy(desc(leads.updatedAt)),
    db
      .select()
      .from(bookings)
      .where(eq(bookings.status, "scheduled"))
      .orderBy(asc(bookings.scheduledAt)),
    db
      .select({
        leadId: emailJobs.leadId,
        sendAt: emailJobs.sendAt,
        name: emailTemplates.name,
      })
      .from(emailJobs)
      .innerJoin(emailTemplates, eq(emailJobs.templateId, emailTemplates.id))
      .where(eq(emailJobs.status, "pending"))
      .orderBy(asc(emailJobs.sendAt)),
  ]);

  const upcomingByLead = new Map<string, Date>();
  for (const b of scheduledBookings) {
    if (
      b.scheduledAt.getTime() >= Date.now() &&
      !upcomingByLead.has(b.leadId)
    ) {
      upcomingByLead.set(b.leadId, b.scheduledAt);
    }
  }

  const nextJobByLead = new Map<string, { name: string; sendAt: Date }>();
  for (const j of pendingJobs) {
    if (!nextJobByLead.has(j.leadId)) {
      nextJobByLead.set(j.leadId, { name: j.name, sendAt: j.sendAt });
    }
  }

  return allLeads.map((l) => {
    const job = nextJobByLead.get(l.id) ?? null;
    return {
      id: l.id,
      firstName: l.firstName,
      lastName: l.lastName,
      email: l.email,
      packageInterest: l.packageInterest,
      stage: l.stage,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      notes: l.notes,
      phone: l.phone,
      upcomingBookingAt: upcomingByLead.get(l.id) ?? null,
      nextEmailName: job?.name ?? null,
      nextEmailSendAt: job?.sendAt ?? null,
    };
  });
}

export async function loadClosedLeadRows(
  stage: "closed" | "lost",
): Promise<LeadRow[]> {
  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.stage, stage))
    .orderBy(desc(leads.updatedAt));

  return rows.map((l) => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email,
    packageInterest: l.packageInterest,
    stage: l.stage,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    notes: l.notes,
    phone: l.phone,
    upcomingBookingAt: null,
    nextEmailName: null,
    nextEmailSendAt: null,
  }));
}
