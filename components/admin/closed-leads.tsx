"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Archive, Check, Film, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadRow } from "@/lib/admin/lead-rows";
import { Avatar, PackageBadge, relativeTime } from "./shared";

const PKG_VALUE: Record<LeadRow["packageInterest"], number> = {
  legacy: 2500,
  heirloom: 3500,
  unsure: 0,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function ClosedLeads({
  paid,
  lost,
}: {
  paid: LeadRow[];
  lost: LeadRow[];
}) {
  const [tab, setTab] = useState<"paid" | "lost">("paid");
  const rows = tab === "paid" ? paid : lost;

  const revenue = paid.reduce(
    (sum, l) => sum + (PKG_VALUE[l.packageInterest] || 0),
    0,
  );
  const heirloomCount = paid.filter((l) => l.packageInterest === "heirloom")
    .length;
  const legacyCount = paid.filter((l) => l.packageInterest === "legacy").length;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-(--adm-border) bg-(--adm-surface) flex-wrap">
        <div>
          <div className="text-lg text-(--adm-text) leading-tight">Closed</div>
          <div className="text-[11px] text-(--adm-text-muted) mt-0.5">
            {paid.length} films delivered · {lost.length} lost · all-time
          </div>
        </div>
        <div className="inline-flex border border-(--adm-border) bg-(--adm-surface)">
          <TabButton
            active={tab === "paid"}
            onClick={() => setTab("paid")}
            label={`Paid · ${paid.length}`}
          />
          <TabButton
            active={tab === "lost"}
            onClick={() => setTab("lost")}
            label={`Lost · ${lost.length}`}
          />
        </div>
      </div>

      {tab === "paid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-6 py-4 bg-(--adm-surface-2) border-b border-(--adm-border)">
          <Stat
            label="Lifetime revenue"
            value={`$${revenue.toLocaleString()}`}
            sub="CAD"
            tone="gold"
          />
          <Stat
            label="The Heirloom"
            value={heirloomCount.toString()}
            sub="$3,500 ea"
          />
          <Stat
            label="The Legacy"
            value={legacyCount.toString()}
            sub="$2,500 ea"
          />
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-(--adm-text-muted)">
            {tab === "paid" ? "No films delivered yet." : "No lost leads."}
          </div>
        ) : (
          rows.map((l) => <ClosedRow key={l.id} lead={l} tab={tab} />)
        )}
        {tab === "lost" && rows.length > 0 && (
          <div className="px-6 py-3.5 text-[11px] text-(--adm-text-muted) border-t border-(--adm-border) flex items-center gap-1.5">
            <Sparkles className="size-3" />
            Mostly: budget, or chose to film themselves
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "font-heading text-[0.65rem] uppercase tracking-[0.12em] px-3.5 py-1.5 transition-colors",
        active
          ? "bg-forest text-gold"
          : "text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)",
      )}
    >
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "gold";
}) {
  return (
    <div
      className={cn(
        "bg-(--adm-surface) border border-(--adm-border) border-l-2 p-3.5",
        tone === "gold" ? "border-l-gold" : "border-l-(--adm-border)",
      )}
    >
      <div className="font-heading text-[0.6rem] tracking-[0.18em] uppercase text-(--adm-text-muted)">
        {label}
      </div>
      <div
        className={cn(
          "font-heading text-2xl leading-none mt-1.5",
          tone === "gold" ? "text-gold" : "text-(--adm-text)",
        )}
      >
        {value}
      </div>
      <div className="text-[11px] text-(--adm-text-muted) mt-1">{sub}</div>
    </div>
  );
}

function ClosedRow({
  lead,
  tab,
}: {
  lead: LeadRow;
  tab: "paid" | "lost";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("lead") === lead.id;

  const open = () => {
    const sp = new URLSearchParams(params.toString());
    sp.set("lead", lead.id);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const daysOpen = Math.round(
    (lead.updatedAt.getTime() - lead.createdAt.getTime()) / DAY_MS,
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
        "group grid grid-cols-[auto_1fr_auto_auto] gap-4 px-6 py-3.5 border-b border-(--adm-border) cursor-pointer transition-colors items-center relative",
        selected ? "bg-(--adm-selected)" : "hover:bg-(--adm-hover)",
      )}
    >
      {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-gold" />}
      <Avatar first={lead.firstName} last={lead.lastName} size={36} />
      <div className="min-w-0">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 font-heading text-[0.6rem] uppercase tracking-[0.14em] mb-1",
            tab === "paid" ? "text-gold" : "text-(--adm-text-muted)",
          )}
        >
          {tab === "paid" ? (
            <Check className="size-3" />
          ) : (
            <X className="size-3" />
          )}
          {tab === "paid" ? "Delivered" : "Lost"} · {relativeTime(lead.updatedAt)}
          <span className="text-(--adm-text-muted) opacity-70">·</span>
          <span className="text-(--adm-text-muted)">{daysOpen}d open</span>
        </div>
        <div className="text-sm text-(--adm-text) leading-snug">
          {lead.firstName} {lead.lastName} · {lead.email}
        </div>
        {lead.notes && (
          <div className="text-xs text-(--adm-text-muted) truncate mt-0.5">{lead.notes}</div>
        )}
      </div>
      <div className="text-right">
        <PackageBadge pkg={lead.packageInterest} />
        {tab === "paid" && (
          <div className="font-heading text-base text-gold mt-1.5">
            ${PKG_VALUE[lead.packageInterest]?.toLocaleString() ?? 0}
          </div>
        )}
      </div>
      <div
        className={cn(
          "flex items-center gap-0.5 transition-opacity",
          selected
            ? "opacity-100"
            : "opacity-100 md:opacity-0 md:group-hover:opacity-100",
        )}
      >
        {tab === "paid" ? (
          <>
            <Link
              href={`/admin/leads/${lead.id}`}
              onClick={(e) => e.stopPropagation()}
              aria-label="Send follow-up"
              className="size-7 inline-flex items-center justify-center text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)"
            >
              <Send className="size-3.5" />
            </Link>
            <button
              type="button"
              aria-label="View deliverables"
              onClick={(e) => e.stopPropagation()}
              className="size-7 inline-flex items-center justify-center text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)"
            >
              <Film className="size-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label="Revive"
              onClick={(e) => e.stopPropagation()}
              className="size-7 inline-flex items-center justify-center text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)"
            >
              <RefreshCw className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Archive"
              onClick={(e) => e.stopPropagation()}
              className="size-7 inline-flex items-center justify-center text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)"
            >
              <Archive className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
