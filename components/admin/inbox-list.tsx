"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Calendar,
  Flame,
  Send,
  Clock,
  UserPlus,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DayDivider,
  PackageBadge,
  dateLongLabel,
  dayLabel,
  relativeTime,
  timeLabel,
} from "./shared";
import type { InboxEvent } from "@/lib/admin/inbox-events";

type Filter = "all" | "waiting" | "calls" | "sent";

type RowMeta = {
  label: string;
  icon: LucideIcon;
  tone: "gold" | "blush" | "moss" | "muted";
};

const META: Record<InboxEvent["kind"], RowMeta> = {
  "lead-new": { label: "New lead", icon: UserPlus, tone: "gold" },
  call: { label: "Call", icon: Calendar, tone: "gold" },
  waiting: { label: "Waiting", icon: Bell, tone: "blush" },
  cold: { label: "Cold", icon: Flame, tone: "blush" },
  sent: { label: "Email sent", icon: Send, tone: "moss" },
  pending: { label: "Email queued", icon: Clock, tone: "muted" },
};

const TONE_TEXT: Record<RowMeta["tone"], string> = {
  gold: "text-gold",
  blush: "text-blush",
  moss: "text-moss",
  muted: "text-tofino",
};

export function InboxList({ events }: { events: InboxEvent[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filter === "calls" && e.kind !== "call") return false;
      if (filter === "sent" && e.kind !== "sent" && e.kind !== "pending")
        return false;
      if (
        filter === "waiting" &&
        e.kind !== "waiting" &&
        e.kind !== "cold" &&
        e.kind !== "lead-new"
      )
        return false;
      if (query) {
        const q = query.toLowerCase();
        const haystack = (
          e.leadFirstName +
          " " +
          e.leadLastName +
          " " +
          e.leadEmail +
          " " +
          e.title +
          " " +
          e.preview
        ).toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, filter, query]);

  const rows = useMemo(() => {
    const out: Array<
      | { kind: "day"; key: number; label: string; sub: string }
      | { kind: "event"; event: InboxEvent }
    > = [];
    let lastKey: number | null = null;
    for (const e of filtered) {
      const d = new Date(e.at);
      d.setHours(0, 0, 0, 0);
      const key = d.getTime();
      if (key !== lastKey) {
        out.push({
          kind: "day",
          key,
          label: dayLabel(d),
          sub: dateLongLabel(d),
        });
        lastKey = key;
      }
      out.push({ kind: "event", event: e });
    }
    return out;
  }, [filtered]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Toolbar
        filter={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
      />
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-(--adm-text-muted)">
            Nothing here yet. New leads, booked calls, and queued emails will appear in this stream.
          </div>
        ) : (
          rows.map((row, i) =>
            row.kind === "day" ? (
              <DayDivider key={`d-${row.key}-${i}`} label={row.label} sub={row.sub} />
            ) : (
              <EventRow key={row.event.id} event={row.event} />
            ),
          )
        )}
      </div>
    </div>
  );
}

function Toolbar({
  filter,
  onFilterChange,
  query,
  onQueryChange,
}: {
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  query: string;
  onQueryChange: (q: string) => void;
}) {
  const tabs: Array<{ id: Filter; label: string }> = [
    { id: "all", label: "All" },
    { id: "waiting", label: "Needs reply" },
    { id: "calls", label: "Calls" },
    { id: "sent", label: "Email activity" },
  ];

  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-(--adm-border) bg-(--adm-surface) flex-wrap">
      <div className="inline-flex border border-(--adm-border) bg-(--adm-surface)">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onFilterChange(t.id)}
            className={cn(
              "font-heading text-[0.65rem] uppercase tracking-[0.12em] px-3.5 py-1.5 transition-colors",
              filter === t.id
                ? "bg-forest text-gold"
                : "text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="inline-flex items-center gap-2 h-8 px-2.5 bg-(--adm-surface) border border-(--adm-border) w-full sm:min-w-[240px]">
          <Search className="size-3.5 text-(--adm-text-muted) shrink-0" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search inbox…"
            className="flex-1 bg-transparent border-0 outline-0 text-xs text-(--adm-text) placeholder:text-(--adm-text-muted)"
          />
        </div>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: InboxEvent }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const meta = META[event.kind];
  const Icon = meta.icon;
  const future = event.at.getTime() > Date.now();
  const selectedLead = params.get("lead");
  const selected = selectedLead === event.leadId;

  const open = () => {
    const sp = new URLSearchParams(params.toString());
    sp.set("lead", event.leadId);
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
        "grid grid-cols-[80px_1fr] gap-3.5 px-6 py-3 border-b border-(--adm-border) cursor-pointer transition-colors items-start relative",
        selected ? "bg-(--adm-selected)" : "hover:bg-(--adm-hover)",
      )}
    >
      {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-gold" />}
      <div className="font-heading text-[11px] text-(--adm-text-muted) pt-px tracking-wide leading-snug">
        {(future ? "in " : "") +
          relativeTime(event.at).replace(/ ago$/, future ? "" : " ago")}
        <br />
        <span className="opacity-70 tracking-normal">{timeLabel(event.at)}</span>
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 font-heading text-[0.6rem] uppercase tracking-[0.14em] mb-1",
            TONE_TEXT[meta.tone],
          )}
        >
          <Icon className="size-3" />
          {meta.label}
          <span className="text-(--adm-text-muted) opacity-70">·</span>
          <span className="text-(--adm-text-muted)">
            {event.leadFirstName} {event.leadLastName}
          </span>
          <PackageBadge pkg={event.leadPackage} />
        </div>
        <div className="text-sm text-(--adm-text) leading-snug">{event.title}</div>
        <div className="text-xs text-(--adm-text-muted) mt-0.5 truncate">{event.preview}</div>
      </div>
    </div>
  );
}
