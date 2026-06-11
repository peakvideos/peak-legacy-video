import { loadOutboxPending, loadOutboxSent } from "@/lib/admin/outbox";
import { getSettings } from "@/lib/stages/settings";
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
import {
  OutboxSentList,
  type OutboxSentItem,
} from "@/components/admin/outbox-sent-list";
import { OutboxPauseSwitch } from "@/components/admin/outbox-pause-switch";

export const dynamic = "force-dynamic";

const dateTimeFmt = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function OutboxPage() {
  const [pendingRows, sentRows, { paused }] = await Promise.all([
    loadOutboxPending(),
    loadOutboxSent(),
    getSettings(),
  ]);

  const items: OutboxItem[] = pendingRows.map((r) => ({
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

  const sentItems: OutboxSentItem[] = sentRows.map((r) => ({
    id: r.id,
    leadId: r.leadId,
    recipientName: r.recipientName,
    recipientEmail: r.recipientEmail,
    templateId: r.templateId,
    templateName: r.templateName,
    templateSubject: r.templateSubject,
    status: r.status,
    attempts: r.attempts,
    lastError: r.lastError,
    atLabel: dateTimeFmt.format(r.at),
  }));

  return (
    <div className="flex-1 min-w-0 overflow-auto px-4 sm:px-6 py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-(--adm-text) text-2xl mb-1">Outbox</h1>
          <p className="text-(--adm-text-muted) text-xs">
            Every email the system is about to send, and the record of what
            went out. Expand a pending row to see exactly what will go out.
          </p>
        </div>
        <OutboxPauseSwitch paused={paused} />
      </header>

      {paused && (
        <div className="border border-blush/50 bg-blush/10 px-4 py-3">
          <p className="text-sm text-blush">
            Sending is paused — {items.length} queued email
            {items.length === 1 ? " is" : "s are"} held in place. Nothing goes
            out until you resume; held emails then send on the next run.
          </p>
        </div>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({items.length})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({sentItems.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4 min-w-0">
          <OutboxPendingList items={items} />
        </TabsContent>
        <TabsContent value="sent" className="mt-4 min-w-0">
          <OutboxSentList items={sentItems} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
