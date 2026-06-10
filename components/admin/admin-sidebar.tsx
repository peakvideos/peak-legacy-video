"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  CalendarDays,
  Flame,
  Columns3,
  LayoutDashboard,
  Archive,
  Route,
  Send,
  FileText,
  LogOut,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useTransition } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

export type AdminSidebarCounts = {
  inbox: number;
  calls: number;
  stuck: number;
  active: number;
  closed: number;
};

type Item = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  countKey?: keyof AdminSidebarCounts;
};

type Section = {
  label: string;
  items: Item[];
};

const SECTIONS: Section[] = [
  {
    label: "Studio",
    items: [
      { id: "inbox", href: "/admin", label: "Inbox", icon: Inbox, countKey: "inbox" },
      {
        id: "calls",
        href: "/admin/calls",
        label: "Calls this week",
        icon: CalendarDays,
        countKey: "calls",
      },
      {
        id: "stuck",
        href: "/admin/stuck",
        label: "Stuck · 14d+",
        icon: Flame,
        countKey: "stuck",
      },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { id: "boards", href: "/admin/boards", label: "Boards", icon: Columns3 },
      {
        id: "active",
        href: "/admin/active",
        label: "Active leads",
        icon: LayoutDashboard,
        countKey: "active",
      },
      {
        id: "closed",
        href: "/admin/closed",
        label: "Closed",
        icon: Archive,
        countKey: "closed",
      },
      {
        id: "pipeline-settings",
        href: "/admin/settings/pipeline",
        label: "Settings",
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    label: "Automations",
    items: [
      { id: "journey", href: "/admin/journey", label: "Journey", icon: Route },
      { id: "sequences", href: "/admin/sequences", label: "Sequences", icon: Send },
      {
        id: "templates",
        href: "/admin/settings/templates",
        label: "Templates",
        icon: FileText,
      },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/leads/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({
  counts,
  userEmail,
}: {
  counts: AdminSidebarCounts;
  userEmail: string;
}) {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-(--adm-border)">
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
          <Link
            href="/admin"
            onClick={closeMobile}
            className="flex items-center gap-2 flex-1 min-w-0 px-1 py-1 font-heading text-[0.7rem] uppercase tracking-[0.18em] text-gold group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:px-0"
            title="Peak Studios CO · Studio"
          >
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-gold/15 border border-gold/40 text-gold font-heading text-sm">
              P
            </span>
            <span className="truncate group-data-[collapsible=icon]:hidden">
              Peak Studios CO
            </span>
          </Link>
          <SidebarTrigger className="shrink-0 text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="font-heading text-[0.6rem] tracking-[0.18em] uppercase text-(--adm-text-muted)">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const count = item.countKey ? counts[item.countKey] : null;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          active &&
                            "border-l-2 border-l-gold rounded-l-none data-active:bg-(--adm-surface-2) data-active:text-(--adm-text)",
                        )}
                      >
                        <Link href={item.href} onClick={closeMobile}>
                          <item.icon
                            className={cn(active ? "text-gold" : "text-(--adm-text-muted)")}
                          />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {count != null && count > 0 && (
                        <SidebarMenuBadge
                          className={cn(
                            "border tabular-nums",
                            active
                              ? "bg-gold/15 border-gold/40 text-gold"
                              : "border-(--adm-border) text-(--adm-text-muted) bg-(--adm-surface-2)",
                          )}
                        >
                          {count}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-(--adm-border) gap-1">
        <SidebarUserRow email={userEmail} />
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarUserRow({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const initial = email.slice(0, 1).toUpperCase();

  const handleSignOut = () => {
    startTransition(async () => {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/sign-in";
          },
        },
      });
    });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={email}
          className="cursor-default hover:bg-transparent"
        >
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-gold/15 border border-gold/40 text-gold font-heading text-[10px]">
            {initial}
          </span>
          <span className="truncate text-xs text-(--adm-text)">{email}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <ThemeToggle />
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={pending ? "Signing out…" : "Sign out"}
          disabled={pending}
          onClick={handleSignOut}
          className="text-(--adm-text-muted) hover:text-(--adm-text)"
        >
          <LogOut />
          <span>{pending ? "Signing out…" : "Sign out"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
