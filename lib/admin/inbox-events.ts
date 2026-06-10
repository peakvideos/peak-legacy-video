import "server-only";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, emailJobs, emailTemplates, leads } from "@/lib/db/schema";
import { listStages } from "@/lib/stages";
import { getSettings } from "@/lib/stages/settings";
import type { PackageInterest } from "@/components/admin/shared";

export type EventKind =
  | "lead-new"
  | "call"
  | "waiting"
  | "cold"
  | "sent"
  | "pending";

const DAY_MS = 24 * 60 * 60 * 1000;
const SENT_LOOKBACK_DAYS = 30;

export type InboxEvent = {
  id: string;
  leadId: string;
  kind: EventKind;
  at: Date;
  /** Most recent activity timestamp for this lead — used to detect "cold". */
  leadUpdatedAt: Date;
  leadCreatedAt: Date;
  leadFirstName: string;
  leadLastName: string;
  leadEmail: string;
  leadPackage: PackageInterest;
  title: string;
  preview: string;
};

export async function loadInboxEvents(): Promise<InboxEvent[]> {
  const sentLookback = new Date(Date.now() - SENT_LOOKBACK_DAYS * DAY_MS);

  const [{ coldThresholdDays }, allStages, allLeads, scheduledBookings, recentJobs] = await Promise.all([
    getSettings(),
    listStages(),
    db.select().from(leads).orderBy(desc(leads.createdAt)),
    db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "scheduled"),
          gte(bookings.scheduledAt, new Date()),
        ),
      )
      .orderBy(asc(bookings.scheduledAt)),
    db
      .select({
        id: emailJobs.id,
        leadId: emailJobs.leadId,
        sendAt: emailJobs.sendAt,
        sentAt: emailJobs.sentAt,
        status: emailJobs.status,
        templateName: emailTemplates.name,
        templateSubject: emailTemplates.subject,
      })
      .from(emailJobs)
      .innerJoin(emailTemplates, eq(emailJobs.templateId, emailTemplates.id))
      .where(gte(emailJobs.updatedAt, sentLookback)),
  ]);

  const stageById = new Map(allStages.map((s) => [s.id, s]));
  const leadById = new Map(allLeads.map((l) => [l.id, l]));
  const upcomingByLead = new Map<string, (typeof scheduledBookings)[number]>();
  for (const b of scheduledBookings) {
    if (!upcomingByLead.has(b.leadId)) upcomingByLead.set(b.leadId, b);
  }

  const events: InboxEvent[] = [];

  for (const l of allLeads) {
    const stage = stageById.get(l.stageId);
    const base = {
      leadId: l.id,
      leadCreatedAt: l.createdAt,
      leadUpdatedAt: l.updatedAt,
      leadFirstName: l.firstName,
      leadLastName: l.lastName,
      leadEmail: l.email,
      leadPackage: l.packageInterest,
    };

    events.push({
      ...base,
      id: `lead-${l.id}`,
      kind: "lead-new",
      at: l.createdAt,
      title: `${l.firstName} ${l.lastName} submitted the booking form`,
      preview: l.notes?.trim() || "No additional notes — interested in this package.",
    });

    const booking = upcomingByLead.get(l.id);
    if (booking) {
      events.push({
        ...base,
        id: `call-${booking.id}`,
        kind: "call",
        at: booking.scheduledAt,
        title: `Discovery call · ${l.firstName} ${l.lastName}`,
        preview: `${l.packageInterest} · ${l.phone ?? "phone TBD"} · 30 min`,
      });
    }

    const stuckDays = Math.floor(
      (Date.now() - l.updatedAt.getTime()) / DAY_MS,
    );
    const isTerminal = !!stage && (stage.isWon || stage.isLost);

    if (!isTerminal && stage?.needsAction) {
      events.push({
        ...base,
        id: `wait-${l.id}`,
        kind: "waiting",
        at: l.updatedAt,
        title: `${l.firstName} is waiting on you`,
        preview: "Reply or advance the stage to clear this.",
      });
    }

    if (!isTerminal && stuckDays >= coldThresholdDays) {
      events.push({
        ...base,
        id: `cold-${l.id}`,
        kind: "cold",
        at: l.updatedAt,
        title: `${l.firstName} ${l.lastName} has been cold for ${stuckDays} days`,
        preview: "Decide whether to archive or revive with a final note.",
      });
    }
  }

  for (const j of recentJobs) {
    const lead = leadById.get(j.leadId);
    if (!lead) continue;
    const base = {
      leadId: lead.id,
      leadCreatedAt: lead.createdAt,
      leadUpdatedAt: lead.updatedAt,
      leadFirstName: lead.firstName,
      leadLastName: lead.lastName,
      leadEmail: lead.email,
      leadPackage: lead.packageInterest,
    };
    if (j.status === "sent" && j.sentAt) {
      events.push({
        ...base,
        id: `sent-${j.id}`,
        kind: "sent",
        at: j.sentAt,
        title: `Sent ${j.templateName} to ${lead.firstName}`,
        preview: j.templateSubject,
      });
    } else if (j.status === "pending") {
      events.push({
        ...base,
        id: `pending-${j.id}`,
        kind: "pending",
        at: j.sendAt,
        title: `Queued ${j.templateName} for ${lead.firstName} ${lead.lastName}`,
        preview: j.templateSubject,
      });
    }
  }

  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  return events;
}
