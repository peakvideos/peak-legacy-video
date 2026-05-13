"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar, RefreshCw, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Avatar,
  DayDivider,
  PackageBadge,
  dateLongLabel,
  dayLabel,
  timeLabel,
} from "./shared";
import type { LeadRow } from "@/lib/admin/lead-rows";

const PKG_LABELS = {
  legacy: "The Legacy",
  heirloom: "The Heirloom",
  unsure: "Package TBD",
} as const;

export function CallsView({ calls }: { calls: LeadRow[] }) {
  const upcoming = calls.filter((c) => c.upcomingBookingAt);
  const days = new Map<number, LeadRow[]>();
  for (const c of upcoming) {
    if (!c.upcomingBookingAt) continue;
    const d = new Date(c.upcomingBookingAt);
    d.setHours(0, 0, 0, 0);
    const key = d.getTime();
    const arr = days.get(key) ?? [];
    arr.push(c);
    days.set(key, arr);
  }
  const sortedKeys = Array.from(days.keys()).sort();

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="px-6 py-3 border-b border-(--adm-border) bg-(--adm-surface)">
        <div className="text-lg text-(--adm-text) leading-tight">Calls this week</div>
        <div className="text-[11px] text-(--adm-text-muted) mt-0.5">
          {upcoming.length} scheduled · all times Pacific
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {sortedKeys.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-(--adm-text-muted)">
            No discovery calls on the books. They&apos;ll show up here when leads book.
          </div>
        ) : (
          sortedKeys.map((k) => {
            const day = new Date(k);
            const rows = days.get(k) ?? [];
            return (
              <div key={k}>
                <DayDivider
                  label={dayLabel(day)}
                  sub={`${dateLongLabel(day)} · ${rows.length} call${rows.length === 1 ? "" : "s"}`}
                />
                {rows.map((l) => (
                  <CallRow key={l.id} lead={l} />
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CallRow({ lead }: { lead: LeadRow }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("lead") === lead.id;

  const open = () => {
    const sp = new URLSearchParams(params.toString());
    sp.set("lead", lead.id);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={cn(
        "group grid grid-cols-[80px_1fr_auto] gap-3.5 px-6 py-3 border-b border-(--adm-border) cursor-pointer transition-colors items-start relative",
        selected ? "bg-(--adm-selected)" : "hover:bg-(--adm-hover)",
      )}
    >
      {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-gold" />}
      <div className="font-heading text-[11px] text-(--adm-text-muted) pt-px tracking-wide leading-snug">
        {lead.upcomingBookingAt && timeLabel(lead.upcomingBookingAt)}
        <br />
        <span className="opacity-70 tracking-normal">30 min</span>
      </div>
      <div className="min-w-0 flex items-start gap-3">
        <Avatar first={lead.firstName} last={lead.lastName} size={28} />
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 font-heading text-[0.6rem] uppercase tracking-[0.14em] mb-1 text-gold">
            <Calendar className="size-3" />
            Discovery call
            <PackageBadge pkg={lead.packageInterest} />
          </div>
          <div className="text-sm text-(--adm-text) leading-snug">
            {lead.firstName} {lead.lastName} · {PKG_LABELS[lead.packageInterest]} ·{" "}
            {lead.phone || "phone TBD"}
          </div>
          {lead.notes && (
            <div className="text-xs text-(--adm-text-muted) truncate mt-0.5">{lead.notes}</div>
          )}
        </div>
      </div>
      <div
        className={cn(
          "flex items-center gap-0.5 pt-0.5 transition-opacity",
          selected
            ? "opacity-100"
            : "opacity-100 md:opacity-0 md:group-hover:opacity-100",
        )}
      >
        <button
          type="button"
          aria-label="Video link"
          onClick={(e) => e.stopPropagation()}
          className="size-7 inline-flex items-center justify-center text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)"
        >
          <Video className="size-3.5" />
        </button>
        <Link
          href={`/admin/leads/${lead.id}`}
          aria-label="Reschedule"
          onClick={(e) => e.stopPropagation()}
          className="size-7 inline-flex items-center justify-center text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)"
        >
          <RefreshCw className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
