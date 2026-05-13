"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type ReactNode } from "react";
import { useAdminTheme } from "./admin-theme";

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
  const { theme } = useAdminTheme();

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          router.replace(pathname, { scroll: false });
        }
      }}
    >
      <SheetContent
        className={cn("admin-shell", theme === "dark" && "dark", "bg-(--adm-surface)")}
      >
        <SheetHeader>
          <SheetTitle className="text-(--adm-text)">Lead detail</SheetTitle>
          {leadId && (
            <Link
              href={`/admin/leads/${leadId}`}
              className="font-heading text-[0.65rem] uppercase tracking-[0.1em] text-(--adm-text-muted) hover:text-gold flex items-center gap-1.5 mr-9"
              title="Open in dedicated page"
            >
              Expand
              <ExternalLink className="size-3" />
            </Link>
          )}
        </SheetHeader>
        <SheetBody>{children}</SheetBody>
      </SheetContent>
    </Sheet>
  );
}
