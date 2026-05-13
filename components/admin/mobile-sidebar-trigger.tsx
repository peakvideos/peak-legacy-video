"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Mobile-only menu button. Shown when the sidebar is offscreen on small
 * viewports. On desktop the shadcn Sidebar always stays at least
 * icon-collapsed, so the trigger inside the sidebar header is enough.
 */
export function MobileSidebarTrigger() {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label="Open menu"
      className="md:hidden inline-flex items-center gap-2 px-4 h-12 border-b border-(--adm-border) bg-(--adm-surface) text-(--adm-text) shrink-0"
    >
      <Menu className="size-4" />
      <span className="font-heading text-[0.7rem] uppercase tracking-[0.18em] text-gold">
        Peak Studios CO
      </span>
    </button>
  );
}
