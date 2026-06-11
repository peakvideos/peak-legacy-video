import { loadOutboxPending } from "@/lib/admin/outbox";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  OutboxPendingList,
  type OutboxItem,
} from "@/components/admin/outbox-pending-list";

export const dynamic = "force-dynamic";

const dateTimeFmt = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function OutboxPage() {
  const rows = await loadOutboxPending();

  const items: OutboxItem[] = rows.map((r) => ({
    id: r.id,
    leadId: r.leadId,
    recipientName: r.recipientName,
    recipientEmail: r.recipientEmail,
    templateId: r.templateId,
    templateName: r.templateName,
    templateSubject: r.templateSubject,
    attempts: r.attempts,
    sendAtLabel: dateTimeFmt.format(r.sendAt),
  }));

  return (
    <div className="flex-1 min-w-0 overflow-auto px-4 sm:px-6 py-6 space-y-6">
      <header>
        <h1 className="text-(--adm-text) text-2xl mb-1">Outbox</h1>
        <p className="text-(--adm-text-muted) text-xs">
          Every email the system is about to send, in send order. Expand a row
          to see exactly what will go out.
        </p>
      </header>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({items.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4 min-w-0">
          <OutboxPendingList items={items} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
