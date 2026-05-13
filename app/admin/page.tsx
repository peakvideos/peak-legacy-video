import { and, asc, count, countDistinct, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, emailJobs, emailTemplates, leads } from "@/lib/db/schema";
import { KanbanBoard } from "@/components/admin/kanban-board";
import type { KanbanLeadRow } from "@/components/admin/kanban-card";
import { LeadDetailModal } from "@/components/admin/lead-detail-modal";
import { LeadDetailContent } from "@/components/admin/lead-detail-content";
import { loadLeadDetail } from "@/lib/admin/lead-detail";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const sp = await searchParams;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    newLeadsCount,
    recentBookingsCount,
    openSequencesCount,
    allLeads,
    upcomingBookings,
    nextEmailJobs,
    detail,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(leads)
      .where(gte(leads.createdAt, sevenDaysAgo)),
    db
      .select({ value: count() })
      .from(bookings)
      .where(
        and(
          gte(bookings.createdAt, sevenDaysAgo),
          eq(bookings.status, "scheduled"),
        ),
      ),
    db
      .select({ value: countDistinct(emailJobs.leadId) })
      .from(emailJobs)
      .where(eq(emailJobs.status, "pending")),
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
    stage: l.stage,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    nextEmailJob: nextJobByLead.get(l.id) ?? null,
    upcomingBooking: upcomingByLead.get(l.id) ?? null,
  }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
      <header>
        <h1 className="text-forest text-3xl mb-1">Leads &amp; bookings</h1>
        <p className="text-tofino italic text-sm">
          Drag cards between columns, or click a card to view details. Last 7 days:
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="New leads (7d)" value={newLeadsCount[0]?.value ?? 0} />
        <Stat label="Booked calls (7d)" value={recentBookingsCount[0]?.value ?? 0} />
        <Stat label="Active sequences" value={openSequencesCount[0]?.value ?? 0} />
      </section>

      <section>
        {kanbanLeads.length === 0 ? (
          <div className="bg-white border border-forest/10 p-10 text-center">
            <p className="text-tofino italic">
              No leads yet. They&apos;ll show up here as soon as someone submits the form.
            </p>
          </div>
        ) : (
          <KanbanBoard leads={kanbanLeads} />
        )}
      </section>

      <LeadDetailModal open={!!detail} leadId={detail?.lead.id ?? null}>
        {detail && <LeadDetailContent data={detail} />}
      </LeadDetailModal>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border-l-2 border-gold p-5">
      <p className="font-heading text-[0.7rem] uppercase tracking-[0.18em] text-tofino mb-2">
        {label}
      </p>
      <p className="font-heading text-forest text-3xl">{value}</p>
    </div>
  );
}
