import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, emailJobs, emailTemplates, leads } from "@/lib/db/schema";
import { listStageRows } from "@/lib/stages";
import { getSettings } from "@/lib/stages/settings";
import { loadAutomationCountsByStage } from "@/lib/admin/journey";
import { KanbanBoard } from "@/components/admin/kanban-board";
import type { KanbanLeadRow } from "@/components/admin/kanban-card";
import { LeadDetailModal } from "@/components/admin/lead-detail-modal";
import { LeadDetailContent } from "@/components/admin/lead-detail-content";
import { loadLeadDetail } from "@/lib/admin/lead-detail";

export const dynamic = "force-dynamic";

export default async function BoardsPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const sp = await searchParams;

  const [stageRows, settings, automationCounts, allLeads, upcomingBookings, nextEmailJobs, detail] = await Promise.all([
    listStageRows(),
    getSettings(),
    loadAutomationCountsByStage(),
    db.select().from(leads).orderBy(desc(leads.createdAt)),
    db
      .select()
      .from(bookings)
      .where(eq(bookings.status, "scheduled"))
      .orderBy(asc(bookings.scheduledAt)),
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
      .where(eq(emailJobs.status, "pending"))
      .orderBy(asc(emailJobs.sendAt)),
    sp.lead ? loadLeadDetail(sp.lead) : null,
  ]);

  const upcomingByLead = new Map<string, (typeof upcomingBookings)[number]>();
  for (const b of upcomingBookings) {
    if (b.scheduledAt.getTime() >= Date.now() && !upcomingByLead.has(b.leadId)) {
      upcomingByLead.set(b.leadId, b);
    }
  }

  const nextJobByLead = new Map<string, (typeof nextEmailJobs)[number]>();
  for (const j of nextEmailJobs) {
    if (!nextJobByLead.has(j.leadId)) nextJobByLead.set(j.leadId, j);
  }

  const kanbanLeads: KanbanLeadRow[] = allLeads.map((l) => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email,
    packageInterest: l.packageInterest,
    stageId: l.stageId,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    nextEmailJob: nextJobByLead.get(l.id) ?? null,
    upcomingBooking: upcomingByLead.get(l.id) ?? null,
  }));

  return (
    <div className="flex-1 overflow-auto px-6 py-6">
      <header className="mb-5">
        <h1 className="text-(--adm-text) text-2xl mb-1">Boards</h1>
        <p className="text-(--adm-text-muted) text-xs">
          Drag a card to move stages. Same data as Inbox; different lens.
        </p>
      </header>

      {kanbanLeads.length === 0 ? (
        <div className="bg-(--adm-surface) border border-(--adm-border) p-10 text-center">
          <p className="text-(--adm-text-muted) text-sm">
            No leads yet. They&apos;ll show up here as soon as someone submits the form.
          </p>
        </div>
      ) : (
        <KanbanBoard
          leads={kanbanLeads}
          stages={stageRows}
          automationCounts={automationCounts}
          settings={{
            entryStageId: settings.entryStageId,
            bookingStageId: settings.bookingStageId,
            coldThresholdDays: settings.coldThresholdDays,
          }}
        />
      )}

      <LeadDetailModal open={!!detail} leadId={detail?.lead.id ?? null}>
        {detail && <LeadDetailContent data={detail} />}
      </LeadDetailModal>
    </div>
  );
}
