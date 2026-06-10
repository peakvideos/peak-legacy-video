"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Archive, Flame, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { PackageBadge, relativeTime } from "./shared";
import type { LeadRow } from "@/lib/admin/lead-rows";

const DAY_MS = 24 * 60 * 60 * 1000;

export function StuckView({
  rows,
  coldThresholdDays,
}: {
  rows: LeadRow[];
  coldThresholdDays: number;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="px-6 py-3 border-b border-(--adm-border) bg-(--adm-surface)">
        <div className="text-lg text-(--adm-text) leading-tight">Stuck leads</div>
        <div className="text-[11px] text-(--adm-text-muted) mt-0.5">
          No reply within {coldThresholdDays} days · {rows.length} leads
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-(--adm-text-muted)">
            No stuck leads. Every active lead has activity in the last{" "}
            {coldThresholdDays} days.
          </div>
        ) : (
          rows.map((l) => <StuckRow key={l.id} lead={l} />)
        )}
      </div>
    </div>
  );
}

function StuckRow({ lead }: { lead: LeadRow }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("lead") === lead.id;

  const open = () => {
    const sp = new URLSearchParams(params.toString());
    sp.set("lead", lead.id);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const daysSinceSignup = Math.floor(
    (Date.now() - lead.createdAt.getTime()) / DAY_MS,
  );

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
        "group grid grid-cols-[100px_1fr_auto] gap-3.5 px-6 py-3 border-b border-(--adm-border) cursor-pointer transition-colors items-start relative",
        selected ? "bg-(--adm-selected)" : "hover:bg-(--adm-hover)",
      )}
    >
      {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-gold" />}
      <div className="font-heading text-[11px] pt-px tracking-wide leading-snug text-blush">
        {relativeTime(lead.updatedAt)}
        <br />
        <span className="text-(--adm-text-muted) opacity-70 tracking-normal">
          {daysSinceSignup}d since signup
        </span>
      </div>
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1.5 font-heading text-[0.6rem] uppercase tracking-[0.14em] mb-1 text-blush">
          <Flame className="size-3" />
          Cold · last activity {relativeTime(lead.updatedAt)}
          <PackageBadge pkg={lead.packageInterest} />
        </div>
        <div className="text-sm text-(--adm-text) leading-snug">
          {lead.firstName} {lead.lastName} · {lead.email}
        </div>
        {lead.notes && (
          <div className="text-xs text-(--adm-text-muted) truncate mt-0.5">{lead.notes}</div>
        )}
      </div>
      <div
        className={cn(
          "flex items-center gap-0.5 pt-0.5 transition-opacity",
          selected
            ? "opacity-100"
            : "opacity-100 md:opacity-0 md:group-hover:opacity-100",
        )}
      >
        <Link
          href={`/admin/leads/${lead.id}`}
          aria-label="Final note"
          onClick={(e) => e.stopPropagation()}
          className="size-7 inline-flex items-center justify-center text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)"
        >
          <Send className="size-3.5" />
        </Link>
        <button
          type="button"
          aria-label="Archive"
          onClick={(e) => e.stopPropagation()}
          className="size-7 inline-flex items-center justify-center text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)"
        >
          <Archive className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
