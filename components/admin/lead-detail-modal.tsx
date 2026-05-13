"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ReactNode } from "react";

export function LeadDetailModal({
  open,
  leadId,
  children,
}: {
  open: boolean;
  leadId: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          router.replace(pathname, { scroll: false });
        }
      }}
    >
      <DialogContent
        showCloseButton
        className="!max-w-3xl gap-0 p-0 overflow-hidden border-t-4 border-gold max-h-[90vh] flex flex-col"
      >
        <DialogTitle className="sr-only">Lead detail</DialogTitle>
        {leadId && (
          <div className="flex items-center justify-between gap-4 pl-6 pr-14 py-3 border-b border-forest/8 bg-off-white">
            <span className="font-heading text-[0.7rem] uppercase tracking-[0.18em] text-tofino">
              Lead Detail
            </span>
            <Link
              href={`/admin/leads/${leadId}`}
              className="font-heading text-[0.7rem] uppercase tracking-[0.1em] text-tofino hover:text-gold flex items-center gap-1.5"
              title="Open in dedicated page"
            >
              Expand
              <ExternalLink className="size-3" />
            </Link>
          </div>
        )}
        <div className="px-6 py-6 overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
