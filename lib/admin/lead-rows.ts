import "server-only";
import { asc, desc, eq, inArray, lte, notInArray, or, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, emailJobs, emailTemplates, leads, stages } from "@/lib/db/schema";
import { coldCutoff } from "@/lib/admin/cold";
import { getSettings } from "@/lib/stages/settings";
import type { PackageInterest } from "@/components/admin/shared";

export type LeadRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  packageInterest: PackageInterest;
  stageId: string;
  createdAt: Date;
  updatedAt: Date;
  notes: string | null;
  phone: string | null;
  upcomingBookingAt: Date | null;
  nextEmailName: string | null;
  nextEmailSendAt: Date | null;
};

/** Subquery: ids of terminal stages (Won or Lost flag). */
function terminalStageIds() {
  return db
    .select({ id: stages.id })
    .from(stages)
    .where(or(eq(stages.isWon, true), eq(stages.isLost, true)));
}

export async function loadActiveLeadRows(): Promise<LeadRow[]> {
  const [allLeads, scheduledBookings, pendingJobs] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(notInArray(leads.stageId, terminalStageIds()))
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
      stageId: l.stageId,
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

/** Leads sitting in any stage carrying the given terminal flag. */
export async function loadClosedLeadRows(
  kind: "won" | "lost",
): Promise<LeadRow[]> {
  const flag = kind === "won" ? stages.isWon : stages.isLost;
  const rows = await db
    .select()
    .from(leads)
    .where(
      inArray(
        leads.stageId,
        db.select({ id: stages.id }).from(stages).where(eq(flag, true)),
      ),
    )
    .orderBy(desc(leads.updatedAt));

  return rows.map((l) => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email,
    packageInterest: l.packageInterest,
    stageId: l.stageId,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    notes: l.notes,
    phone: l.phone,
    upcomingBookingAt: null,
    nextEmailName: null,
    nextEmailSendAt: null,
  }));
}

/**
 * Non-terminal leads untouched for at least the cold threshold — the
 * Stuck view.
 */
export async function loadStuckLeadRows(): Promise<LeadRow[]> {
  const { coldThresholdDays } = await getSettings();

  const rows = await db
    .select()
    .from(leads)
    .where(
      and(
        notInArray(leads.stageId, terminalStageIds()),
        lte(leads.updatedAt, coldCutoff(coldThresholdDays)),
      ),
    )
    .orderBy(desc(leads.updatedAt));

  return rows.map((l) => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email,
    packageInterest: l.packageInterest,
    stageId: l.stageId,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    notes: l.notes,
    phone: l.phone,
    upcomingBookingAt: null,
    nextEmailName: null,
    nextEmailSendAt: null,
  }));
}
