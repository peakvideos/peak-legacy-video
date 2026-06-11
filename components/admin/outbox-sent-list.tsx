import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type OutboxSentItem = {
  id: string;
  leadId: string;
  recipientName: string;
  recipientEmail: string;
  templateId: string;
  templateName: string;
  templateSubject: string;
  status: "sent" | "failed";
  atLabel: string;
  attempts: number;
  lastError: string | null;
};

/**
 * The outbox's record of what went out: sent and failed sends on one
 * timeline, newest first. Failed rows carry their last SMTP error so the
 * history doubles as the failure log.
 */
export function OutboxSentList({ items }: { items: OutboxSentItem[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-(--adm-surface) border border-(--adm-border) p-8 text-center">
        <p className="text-(--adm-text-muted) text-sm">
          No emails have been sent yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-(--adm-surface) border border-(--adm-border) overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead className="hidden lg:table-cell">Email</TableHead>
            <TableHead>Template</TableHead>
            <TableHead className="hidden sm:table-cell">When</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="max-w-[200px]">
                <Link
                  href={`/admin/leads/${item.leadId}`}
                  className="font-medium text-(--adm-text) hover:text-gold truncate block"
                >
                  {item.recipientName}
                </Link>
                <span className="text-xs text-(--adm-text-muted) truncate block lg:hidden">
                  {item.recipientEmail}
                </span>
                <span className="text-xs text-(--adm-text-muted) truncate block sm:hidden">
                  {item.atLabel}
                </span>
              </TableCell>
              <TableCell className="text-(--adm-text-muted) hidden lg:table-cell">
                {item.recipientEmail}
              </TableCell>
              <TableCell className="max-w-[180px] sm:max-w-[260px]">
                <Link
                  href={`/admin/settings/templates/${item.templateId}`}
                  className="font-heading text-(--adm-text) hover:text-gold truncate block"
                >
                  {item.templateName}
                </Link>
                <span className="text-(--adm-text-muted) text-xs truncate block">
                  {item.templateSubject}
                </span>
              </TableCell>
              <TableCell className="text-sm text-(--adm-text-muted) whitespace-nowrap hidden sm:table-cell">
                {item.atLabel}
              </TableCell>
              <TableCell>
                {item.status === "sent" ? (
                  <Badge className="bg-gold/15 text-gold border border-gold/40">
                    Sent
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-blush border-blush/50">
                    Failed · {item.attempts}
                  </Badge>
                )}
              </TableCell>
              <TableCell
                title={item.lastError ?? undefined}
                className="text-xs text-(--adm-text-muted) max-w-[260px] truncate hidden md:table-cell"
              >
                {item.lastError ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
