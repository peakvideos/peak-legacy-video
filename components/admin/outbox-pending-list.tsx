"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  cancelEmailJob,
  previewEmailJob,
  sendEmailJobNow,
} from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type OutboxItem = {
  id: string;
  leadId: string;
  recipientName: string;
  recipientEmail: string;
  templateId: string;
  templateName: string;
  templateSubject: string;
  attempts: number;
  sendAtLabel: string;
};

type Preview = { subject: string; html: string };

export function OutboxPendingList({ items }: { items: OutboxItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<
    Record<string, Preview | "loading" | undefined>
  >({});

  if (items.length === 0) {
    return (
      <div className="bg-(--adm-surface) border border-(--adm-border) p-8 text-center">
        <p className="text-(--adm-text-muted) text-sm">
          Nothing queued — the outbox is clear.
        </p>
      </div>
    );
  }

  const toggle = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!previews[id]) {
      setPreviews((p) => ({ ...p, [id]: "loading" }));
      previewEmailJob(id)
        .then((r) =>
          setPreviews((p) => ({
            ...p,
            [id]: { subject: r.subject, html: r.html },
          })),
        )
        .catch((err) => {
          setPreviews((p) => ({ ...p, [id]: undefined }));
          setExpandedId((cur) => (cur === id ? null : cur));
          toast.error(
            err instanceof Error ? err.message : "Failed to render preview.",
          );
        });
    }
  };

  return (
    <div className="bg-(--adm-surface) border border-(--adm-border) overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">&nbsp;</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead className="hidden lg:table-cell">Email</TableHead>
            <TableHead>Template</TableHead>
            <TableHead className="hidden sm:table-cell">Send at</TableHead>
            <TableHead className="text-right">&nbsp;</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const expanded = expandedId === item.id;
            const preview = previews[item.id];
            return (
              <Fragment key={item.id}>
                <TableRow
                  onClick={() => toggle(item.id)}
                  aria-expanded={expanded}
                  className="cursor-pointer"
                >
                  <TableCell className="text-(--adm-text-muted)">
                    {expanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <Link
                      href={`/admin/leads/${item.leadId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-(--adm-text) hover:text-gold truncate block"
                    >
                      {item.recipientName}
                    </Link>
                    <span className="text-xs text-(--adm-text-muted) truncate block lg:hidden">
                      {item.recipientEmail}
                    </span>
                    <span className="text-xs text-(--adm-text-muted) truncate block sm:hidden">
                      {item.sendAtLabel}
                    </span>
                  </TableCell>
                  <TableCell className="text-(--adm-text-muted) hidden lg:table-cell">
                    {item.recipientEmail}
                  </TableCell>
                  <TableCell className="max-w-[180px] sm:max-w-[260px]">
                    <span className="font-heading text-(--adm-text) truncate block">
                      {item.templateName}
                    </span>
                    <span className="text-(--adm-text-muted) text-xs truncate block">
                      {item.templateSubject}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-(--adm-text-muted) whitespace-nowrap hidden sm:table-cell">
                    {item.sendAtLabel}
                    {item.attempts > 0 && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-(--adm-text-muted)"
                      >
                        Retry · {item.attempts}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap space-x-3">
                    <SendNowButton item={item} />
                    <CancelButton item={item} />
                  </TableCell>
                </TableRow>
                {expanded && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={6}
                      className="bg-(--adm-surface-2)/50 p-4"
                    >
                      <PreviewPanel item={item} preview={preview} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * The exact email the lead will receive — rendered server-side through the
 * same pipeline the send worker uses, shown in a sandboxed iframe so the
 * email's own styles can't leak into the admin UI.
 */
function PreviewPanel({
  item,
  preview,
}: {
  item: OutboxItem;
  preview: Preview | "loading" | undefined;
}) {
  if (!preview || preview === "loading") {
    return (
      <p className="text-xs text-(--adm-text-muted) px-1 py-2">
        Rendering preview…
      </p>
    );
  }
  return (
    <div className="border border-(--adm-border) bg-(--adm-surface)">
      <div className="border-b border-(--adm-border) px-4 py-2 bg-(--adm-surface-2) space-y-1.5">
        <div>
          <p className="font-heading text-[0.7rem] uppercase tracking-[0.14em] text-(--adm-text-muted)">
            To
          </p>
          <p className="text-sm text-(--adm-text) truncate">
            {item.recipientName} &lt;{item.recipientEmail}&gt;
          </p>
        </div>
        <div>
          <p className="font-heading text-[0.7rem] uppercase tracking-[0.14em] text-(--adm-text-muted)">
            Subject
          </p>
          <p className="text-sm text-(--adm-text) font-heading truncate">
            {preview.subject}
          </p>
        </div>
      </div>
      <iframe
        title={`Email preview for ${item.recipientEmail}`}
        sandbox=""
        srcDoc={preview.html}
        className="w-full h-[420px] bg-white"
      />
    </div>
  );
}

function SendNowButton({ item }: { item: OutboxItem }) {
  const [pending, startTransition] = useTransition();

  const handle = () => {
    startTransition(async () => {
      try {
        const result = await sendEmailJobNow(item.id);
        if (result.outcome === "sent") {
          toast.success(
            `Sent "${item.templateName}" to ${item.recipientEmail}`,
          );
        } else if (result.outcome === "cancelled") {
          toast.warning(`Not sent — job cancelled. ${result.error ?? ""}`);
        } else if (result.outcome === "retried") {
          toast.error(
            `Send failed — queued for retry. ${result.error ?? ""}`,
          );
        } else {
          toast.error(`Send failed for good. ${result.error ?? ""}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send.");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handle();
      }}
      disabled={pending}
      className="text-[0.7rem] font-heading uppercase tracking-wider text-gold hover:text-gold-light disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send now"}
    </button>
  );
}

function CancelButton({ item }: { item: OutboxItem }) {
  const [pending, startTransition] = useTransition();

  const handle = () => {
    startTransition(async () => {
      try {
        await cancelEmailJob(item.id);
        toast.success(`Cancelled "${item.templateName}"`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to cancel.");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handle();
      }}
      disabled={pending}
      className="text-[0.7rem] font-heading uppercase tracking-wider text-(--adm-text-muted) hover:text-blush disabled:opacity-50"
    >
      {pending ? "…" : "Cancel"}
    </button>
  );
}
