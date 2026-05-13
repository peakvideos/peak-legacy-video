import Link from "next/link";
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailJobs, emailTemplates, leads } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const dateTimeFmt = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const PENDING_LIMIT = 100;
const SENT_LIMIT = 100;
const FAILED_LIMIT = 50;

export default async function SequencesPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const baseSelect = {
    id: emailJobs.id,
    leadId: emailJobs.leadId,
    templateId: emailJobs.templateId,
    sendAt: emailJobs.sendAt,
    sentAt: emailJobs.sentAt,
    status: emailJobs.status,
    attempts: emailJobs.attempts,
    lastError: emailJobs.lastError,
    leadFirstName: leads.firstName,
    leadLastName: leads.lastName,
    leadEmail: leads.email,
    templateName: emailTemplates.name,
    templateSubject: emailTemplates.subject,
  };

  const [
    pendingRows,
    sentRows,
    failedRows,
    pendingCount,
    sentLast7dCount,
    failedCount,
    cancelledCount,
  ] = await Promise.all([
    db
      .select(baseSelect)
      .from(emailJobs)
      .innerJoin(leads, eq(emailJobs.leadId, leads.id))
      .innerJoin(emailTemplates, eq(emailJobs.templateId, emailTemplates.id))
      .where(eq(emailJobs.status, "pending"))
      .orderBy(asc(emailJobs.sendAt))
      .limit(PENDING_LIMIT),
    db
      .select(baseSelect)
      .from(emailJobs)
      .innerJoin(leads, eq(emailJobs.leadId, leads.id))
      .innerJoin(emailTemplates, eq(emailJobs.templateId, emailTemplates.id))
      .where(eq(emailJobs.status, "sent"))
      .orderBy(desc(emailJobs.sentAt))
      .limit(SENT_LIMIT),
    db
      .select(baseSelect)
      .from(emailJobs)
      .innerJoin(leads, eq(emailJobs.leadId, leads.id))
      .innerJoin(emailTemplates, eq(emailJobs.templateId, emailTemplates.id))
      .where(eq(emailJobs.status, "failed"))
      .orderBy(desc(emailJobs.updatedAt))
      .limit(FAILED_LIMIT),
    db
      .select({ value: count() })
      .from(emailJobs)
      .where(eq(emailJobs.status, "pending")),
    db
      .select({ value: count() })
      .from(emailJobs)
      .where(
        and(eq(emailJobs.status, "sent"), gte(emailJobs.sentAt, sevenDaysAgo)),
      ),
    db
      .select({ value: count() })
      .from(emailJobs)
      .where(eq(emailJobs.status, "failed")),
    db
      .select({ value: count() })
      .from(emailJobs)
      .where(eq(emailJobs.status, "cancelled")),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
      <header>
        <h1 className="text-forest text-3xl mb-1">Email sequences</h1>
        <p className="text-tofino italic text-sm">
          Drip emails the cron worker has scheduled, sent, or failed to deliver.
        </p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Pending" value={pendingCount[0]?.value ?? 0} />
        <Stat label="Sent (last 7d)" value={sentLast7dCount[0]?.value ?? 0} />
        <Stat
          label="Failed"
          value={failedCount[0]?.value ?? 0}
          tone={failedCount[0]?.value ? "danger" : "default"}
        />
        <Stat label="Cancelled" value={cancelledCount[0]?.value ?? 0} muted />
      </section>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingCount[0]?.value ?? 0})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Sent ({sentRows.length})
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed ({failedCount[0]?.value ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Section
            empty="No drip emails scheduled."
            rows={pendingRows.map((r) => ({
              ...r,
              when: r.sendAt,
              whenLabel: dateTimeFmt.format(r.sendAt),
            }))}
            timeHeader="Send at"
          />
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          <Section
            empty="No emails have been sent yet."
            rows={sentRows.map((r) => ({
              ...r,
              when: r.sentAt ?? r.sendAt,
              whenLabel: r.sentAt ? dateTimeFmt.format(r.sentAt) : "—",
            }))}
            timeHeader="Sent at"
          />
        </TabsContent>

        <TabsContent value="failed" className="mt-4">
          <Section
            empty="No failed emails."
            rows={failedRows.map((r) => ({
              ...r,
              when: r.sendAt,
              whenLabel: dateTimeFmt.format(r.sendAt),
            }))}
            timeHeader="Last attempt"
            showError
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}

type Row = {
  id: string;
  leadId: string;
  templateId: string;
  sendAt: Date;
  sentAt: Date | null;
  status: "pending" | "sent" | "cancelled" | "failed";
  attempts: number;
  lastError: string | null;
  leadFirstName: string;
  leadLastName: string;
  leadEmail: string;
  templateName: string;
  templateSubject: string;
  when: Date;
  whenLabel: string;
};

function Section({
  rows,
  empty,
  timeHeader,
  showError = false,
}: {
  rows: Row[];
  empty: string;
  timeHeader: string;
  showError?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-forest/10 p-8 text-center">
        <p className="text-tofino italic text-sm">{empty}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-forest/10 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Template</TableHead>
            <TableHead>{timeHeader}</TableHead>
            <TableHead>Status</TableHead>
            {showError && <TableHead>Error</TableHead>}
            <TableHead className="text-right">&nbsp;</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium text-forest whitespace-nowrap">
                {r.leadFirstName} {r.leadLastName}
              </TableCell>
              <TableCell className="text-tofino">
                <a href={`mailto:${r.leadEmail}`} className="hover:text-gold">
                  {r.leadEmail}
                </a>
              </TableCell>
              <TableCell className="whitespace-nowrap max-w-[260px]">
                <Link
                  href={`/admin/settings/templates/${r.templateId}`}
                  className="font-heading text-forest hover:text-gold truncate block"
                >
                  {r.templateName}
                </Link>
                <span className="text-tofino text-xs truncate block">
                  {r.templateSubject}
                </span>
              </TableCell>
              <TableCell className="text-sm text-tofino whitespace-nowrap">
                {r.whenLabel}
              </TableCell>
              <TableCell>
                <StatusBadge status={r.status} attempts={r.attempts} />
              </TableCell>
              {showError && (
                <TableCell className="text-xs text-tofino max-w-[260px] truncate">
                  {r.lastError ?? "—"}
                </TableCell>
              )}
              <TableCell className="text-right">
                <Link
                  href={`/admin/leads/${r.leadId}`}
                  className="font-heading text-xs uppercase tracking-[0.1em] text-gold hover:text-forest"
                >
                  View →
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
  muted = false,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "danger";
  muted?: boolean;
}) {
  const accent =
    tone === "danger" ? "border-blush" : muted ? "border-tofino/40" : "border-gold";
  return (
    <div className={`bg-white border-l-2 ${accent} p-4`}>
      <p className="font-heading text-[0.7rem] uppercase tracking-[0.18em] text-tofino mb-1.5">
        {label}
      </p>
      <p className={`font-heading text-2xl ${muted ? "text-tofino" : "text-forest"}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
  attempts,
}: {
  status: Row["status"];
  attempts: number;
}) {
  if (status === "pending" && attempts > 0) {
    return (
      <Badge variant="outline" className="text-tofino">
        Retry · {attempts}
      </Badge>
    );
  }
  if (status === "sent") {
    return <Badge className="bg-gold/15 text-forest border border-gold/40">Sent</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="outline" className="text-blush border-blush/50">Failed</Badge>;
  }
  if (status === "cancelled") {
    return <Badge variant="outline" className="text-tofino/70">Cancelled</Badge>;
  }
  return <Badge variant="outline" className="text-tofino">Pending</Badge>;
}
