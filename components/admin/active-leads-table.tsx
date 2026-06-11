"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  Circle,
  Flame,
  Reply,
  Search,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isCold } from "@/lib/admin/cold";
import {
  splitBoardViews,
  type StageRow,
  type StageSettings,
} from "@/lib/admin/stages";
import type { LeadRow } from "@/lib/admin/lead-rows";
import {
  Avatar,
  ColdBadge,
  PackageBadge,
  StageBadge,
  dayLabel,
  relativeTime,
  timeLabel,
} from "./shared";

type SortId = "recent" | "submitted" | "oldest" | "stage";

type SortOption = {
  id: SortId;
  label: string;
};

const SORT_OPTIONS: SortOption[] = [
  { id: "recent", label: "Last activity" },
  { id: "submitted", label: "Newest submitted" },
  { id: "oldest", label: "Oldest submitted" },
  { id: "stage", label: "Stage order" },
];

type StageFilter = string | "all";
type PkgFilter = LeadRow["packageInterest"] | "all";
type ColdFilter = "all" | "cold";

export function ActiveLeadsTable({
  rows,
  stages,
  settings,
}: {
  rows: LeadRow[];
  stages: StageRow[];
  settings: StageSettings;
}) {
  const [sortId, setSortId] = useState<SortId>("recent");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [pkgFilter, setPkgFilter] = useState<PkgFilter>("all");
  const [coldFilter, setColdFilter] = useState<ColdFilter>("all");
  const [query, setQuery] = useState("");

  const stageById = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages],
  );
  const funnelStages = useMemo(
    () => splitBoardViews(stages).active,
    [stages],
  );

  const filtered = useMemo(() => {
    return rows.filter((l) => {
      if (stageFilter !== "all" && l.stageId !== stageFilter) return false;
      if (pkgFilter !== "all" && l.packageInterest !== pkgFilter) return false;
      if (
        coldFilter === "cold" &&
        !isCold(l, stageById.get(l.stageId), settings.coldThresholdDays)
      )
        return false;
      if (query) {
        const q = query.toLowerCase();
        const haystack = (
          l.firstName +
          " " +
          l.lastName +
          " " +
          l.email
        ).toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, stageFilter, pkgFilter, coldFilter, query, stageById, settings.coldThresholdDays]);

  const sorted = useMemo(() => {
    const fns: Record<SortId, (a: LeadRow, b: LeadRow) => number> = {
      recent: (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      submitted: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      oldest: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      stage: (a, b) =>
        (stageById.get(a.stageId)?.position ?? Infinity) -
        (stageById.get(b.stageId)?.position ?? Infinity),
    };
    return [...filtered].sort(fns[sortId]);
  }, [filtered, sortId, stageById]);

  const grouped = sortId === "stage";
  const stageGroups: Array<{ stage: StageRow | null; rows: LeadRow[] }> =
    grouped
      ? funnelStages
          .map((s) => ({
            stage: s as StageRow | null,
            rows: sorted.filter((r) => r.stageId === s.id),
          }))
          .filter((g) => g.rows.length > 0)
      : [{ stage: null, rows: sorted }];

  const sortLabel =
    SORT_OPTIONS.find((s) => s.id === sortId)?.label.toLowerCase() ??
    "last activity";

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-6 py-3 border-b border-(--adm-border) bg-(--adm-surface) flex-wrap">
        <div>
          <div className="text-lg text-(--adm-text) leading-tight">Active leads</div>
          <div className="text-[11px] text-(--adm-text-muted) mt-0.5">
            {rows.length} in pipeline · {sorted.length} shown · sorted by{" "}
            {sortLabel}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div className="inline-flex items-center gap-2 h-8 px-2.5 bg-(--adm-surface) border border-(--adm-border) w-full sm:min-w-[220px] sm:w-auto">
            <Search className="size-3.5 text-(--adm-text-muted) shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              className="flex-1 bg-transparent border-0 outline-0 text-xs text-(--adm-text) placeholder:text-(--adm-text-muted)"
            />
          </div>
          <FilterDropdown
            value={stageFilter}
            onChange={(v) => setStageFilter(v as StageFilter)}
            options={[
              { id: "all", label: "All stages" },
              ...funnelStages.map((s) => ({
                id: s.id,
                label: s.name,
              })),
            ]}
          />
          <FilterDropdown
            value={pkgFilter}
            onChange={(v) => setPkgFilter(v as PkgFilter)}
            options={[
              { id: "all", label: "All packages" },
              { id: "legacy", label: "Legacy" },
              { id: "heirloom", label: "Heirloom" },
              { id: "unsure", label: "Unsure" },
            ]}
          />
          <FilterDropdown
            value={coldFilter}
            onChange={(v) => setColdFilter(v as ColdFilter)}
            options={[
              { id: "all", label: "Warm & cold" },
              { id: "cold", label: "Cold only" },
            ]}
          />
          <FilterDropdown
            value={sortId}
            onChange={(v) => setSortId(v as SortId)}
            options={SORT_OPTIONS.map((s) => ({ id: s.id, label: s.label }))}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <Th width="28%">Lead</Th>
              <Th width="12%">Package</Th>
              <Th width="18%">Stage</Th>
              <Th width="22%">Next action</Th>
              <Th width="12%">Last activity</Th>
              <Th width="8%">&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {stageGroups.map((g) => (
              <RowGroup
                key={g.stage?.id ?? "all"}
                stage={g.stage}
                rows={g.rows}
                stageById={stageById}
                coldThresholdDays={settings.coldThresholdDays}
                showEmpty={!g.stage && g.rows.length === 0}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  width,
}: {
  children: React.ReactNode;
  width: string;
}) {
  return (
    <th
      style={{ width }}
      className="sticky top-0 z-2 bg-(--adm-surface-2) border-b border-(--adm-border) font-heading text-[0.6rem] tracking-[0.18em] uppercase text-(--adm-text-muted) text-left py-2.5 px-4 font-normal"
    >
      {children}
    </th>
  );
}

function RowGroup({
  stage,
  rows,
  stageById,
  coldThresholdDays,
  showEmpty,
}: {
  stage: StageRow | null;
  rows: LeadRow[];
  stageById: Map<string, StageRow>;
  coldThresholdDays: number;
  showEmpty: boolean;
}) {
  if (showEmpty) {
    return (
      <tr>
        <td
          colSpan={6}
          className="px-6 py-10 text-center text-(--adm-text-muted) text-xs"
        >
          No active leads match these filters.
        </td>
      </tr>
    );
  }
  return (
    <>
      {stage && (
        <tr>
          <td colSpan={6} className="bg-(--adm-surface-2) px-4 pt-3.5 pb-1.5">
            <span className="font-heading text-[0.6rem] uppercase tracking-[0.18em] text-(--adm-text-muted)">
              {stage.name}
            </span>
            <span className="ml-2.5 font-heading text-[11px] text-(--adm-text-muted) opacity-70">
              {rows.length}
            </span>
          </td>
        </tr>
      )}
      {rows.map((l) => (
        <Row
          key={l.id}
          lead={l}
          stage={stageById.get(l.stageId)}
          coldThresholdDays={coldThresholdDays}
        />
      ))}
    </>
  );
}

function Row({
  lead,
  stage,
  coldThresholdDays,
}: {
  lead: LeadRow;
  stage: StageRow | undefined;
  coldThresholdDays: number;
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

  const nextAction = computeNextAction(lead, stage, coldThresholdDays);
  const NextIcon = nextAction.icon;

  return (
    <tr
      onClick={open}
      className={cn(
        "group cursor-pointer transition-colors border-b border-(--adm-border) align-middle",
        selected ? "bg-(--adm-selected)" : "hover:bg-(--adm-hover)",
      )}
    >
      <td
        className={cn(
          "py-3 px-4 relative",
          selected && "shadow-[inset_3px_0_0_var(--color-gold)]",
        )}
      >
        <div className="flex items-center gap-2.5">
          <Avatar first={lead.firstName} last={lead.lastName} size={26} />
          <div className="min-w-0">
            <div className="font-heading text-sm text-(--adm-text) truncate">
              {lead.firstName} {lead.lastName}
            </div>
            <div className="text-[11px] text-(--adm-text-muted) truncate">{lead.email}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <PackageBadge pkg={lead.packageInterest} />
      </td>
      <td className="py-3 px-4">
        {stage && <StageBadge stage={stage} />}
      </td>
      <td className="py-3 px-4 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <NextIcon className={cn("size-3.5 shrink-0", nextAction.tone)} />
          <span className="text-xs text-(--adm-text) truncate">{nextAction.main}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-(--adm-text-muted)">
            {relativeTime(lead.updatedAt)}
          </span>
          {isCold(lead, stage, coldThresholdDays) && <ColdBadge />}
        </div>
      </td>
      <td className="py-3 px-4">
        <div
          className={cn(
            "flex items-center justify-end gap-0.5 transition-opacity",
            selected
              ? "opacity-100"
              : "opacity-100 md:opacity-0 md:group-hover:opacity-100",
          )}
        >
          <Link
            href={`/admin/leads/${lead.id}`}
            onClick={(e) => e.stopPropagation()}
            aria-label="Reply"
            className="size-7 inline-flex items-center justify-center text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover) transition-colors"
          >
            <Reply className="size-3.5" />
          </Link>
          <button
            type="button"
            aria-label="Open"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            className="size-7 inline-flex items-center justify-center text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover) transition-colors"
          >
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function computeNextAction(
  lead: LeadRow,
  stage: StageRow | undefined,
  coldThresholdDays: number,
) {
  if (lead.upcomingBookingAt) {
    return {
      icon: Calendar,
      tone: "text-gold",
      main: `Call · ${dayLabel(lead.upcomingBookingAt)} · ${timeLabel(lead.upcomingBookingAt)}`,
    };
  }
  if (stage?.needsAction) {
    return { icon: Bell, tone: "text-blush", main: "Reply needed" };
  }
  if (lead.nextEmailName && lead.nextEmailSendAt) {
    return {
      icon: Send,
      tone: "text-(--adm-text-muted)",
      main: `${lead.nextEmailName} · ${dayLabel(lead.nextEmailSendAt)}`,
    };
  }
  if (isCold(lead, stage, coldThresholdDays)) {
    return {
      icon: Flame,
      tone: "text-blush",
      main: "Cold — decide to revive or archive",
    };
  }
  return { icon: Circle, tone: "text-(--adm-text-muted)", main: "—" };
}

function FilterDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="inline-flex items-center justify-between gap-2 min-w-[130px] h-8 px-2.5 border border-(--adm-border) bg-(--adm-surface) text-(--adm-text-muted) hover:text-(--adm-text) hover:border-gold transition-colors"
      >
        <span className="font-heading text-[0.6rem] uppercase tracking-[0.1em] truncate">
          {current?.label}
        </span>
        <ChevronDown className="size-3 shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-30 min-w-[180px] bg-(--adm-surface) border border-(--adm-border) shadow-lg py-1 max-h-80 overflow-auto">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o.id);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center px-3 py-1.5 text-xs hover:bg-(--adm-hover) text-left",
                o.id === value ? "text-gold" : "text-(--adm-text)",
              )}
            >
              {o.id === value ? (
                <Check className="size-3 mr-1.5" />
              ) : (
                <span className="w-3 mr-1.5" />
              )}
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
