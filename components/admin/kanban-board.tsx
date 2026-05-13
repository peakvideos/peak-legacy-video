"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { setLeadStage } from "@/app/admin/actions";
import type { LeadStage } from "@/lib/admin/stages";
import { KanbanCard, type KanbanLeadRow } from "./kanban-card";
import {
  ACTIVE_STAGES,
  SETTLED_STAGES,
  STAGE_LABELS,
  STAGE_ORDER,
  STAGE_TONE,
} from "@/lib/admin/stages";
import { cn } from "@/lib/utils";

type KanbanView = "active" | "settled" | "all";

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function leadMatchesQuery(lead: KanbanLeadRow, query: string): boolean {
  if (!query) return true;
  const q = normalize(query);
  return (
    normalize(lead.firstName).includes(q) ||
    normalize(lead.lastName).includes(q) ||
    normalize(`${lead.firstName} ${lead.lastName}`).includes(q) ||
    normalize(lead.email).includes(q)
  );
}

const NO_DROP_ANIMATION = null;

export function KanbanBoard({ leads }: { leads: KanbanLeadRow[] }) {
  // dnd-kit allocates internal IDs (DndDescribedBy-N) using a module-level
  // counter that diverges between SSR and client renders. Gating the
  // interactive tree behind a mount flag lets the server emit the static
  // layout and the client take over once hydrated, avoiding aria-describedby
  // hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [optimistic, applyOptimistic] = useOptimistic(
    leads,
    (state, update: { id: string; stage: LeadStage }) =>
      state.map((l) =>
        l.id === update.id ? { ...l, stage: update.stage } : l,
      ),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [view, setView] = useState<KanbanView>("active");
  const [query, setQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 6 },
    }),
  );

  const grouped: Record<LeadStage, KanbanLeadRow[]> = {
    new: [],
    stale: [],
    booked_a_call: [],
    call_completed: [],
    video_shoot_scheduled: [],
    post_video_shoot: [],
    closed: [],
    lost: [],
  };
  for (const lead of optimistic) {
    if (!leadMatchesQuery(lead, query)) continue;
    const bucket = grouped[lead.stage];
    if (bucket) {
      bucket.push(lead);
    } else {
      // Unknown stage value (e.g. legacy data not yet migrated) — surface
      // it so it isn't silently lost, then bucket into `new` as a safe
      // default.
      console.warn(
        `[kanban] Lead ${lead.id} has unknown stage '${lead.stage}', falling back to new.`,
      );
      grouped.new.push(lead);
    }
  }

  const stagesShown: LeadStage[] =
    view === "active"
      ? ACTIVE_STAGES
      : view === "settled"
        ? SETTLED_STAGES
        : STAGE_ORDER;

  const totalMatches = optimistic.filter((l) => leadMatchesQuery(l, query)).length;

  const draggingLead = draggingId
    ? optimistic.find((l) => l.id === draggingId)
    : null;

  const handleStart = (event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
  };

  const handleEnd = (event: DragEndEvent) => {
    const leadId = String(event.active.id);
    const overId = event.over?.id;
    setDraggingId(null);
    if (!overId) return;

    const targetStage = String(overId) as LeadStage;
    if (!STAGE_ORDER.includes(targetStage)) return;

    const lead = optimistic.find((l) => l.id === leadId);
    if (!lead || lead.stage === targetStage) return;

    startTransition(async () => {
      applyOptimistic({ id: leadId, stage: targetStage });
      await setLeadStage(leadId, targetStage);
    });
  };

  const controls = (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
      <ViewTabs view={view} onChange={setView} />
      <SearchInput
        value={query}
        onChange={setQuery}
        matchCount={query ? totalMatches : null}
      />
    </div>
  );

  const board = (
    <div className="overflow-x-auto -mx-6 px-6 pb-2">
      <div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-3 min-w-max">
        {stagesShown.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            leads={grouped[stage]}
            tone={STAGE_TONE[stage]}
            interactive={mounted}
          />
        ))}
      </div>
    </div>
  );

  if (!mounted) {
    return (
      <>
        {controls}
        {board}
      </>
    );
  }

  return (
    <>
      {controls}
      <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd}>
        {board}
        <DragOverlay dropAnimation={NO_DROP_ANIMATION}>
          {draggingLead ? <KanbanCard lead={draggingLead} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function ViewTabs({
  view,
  onChange,
}: {
  view: KanbanView;
  onChange: (v: KanbanView) => void;
}) {
  const tabs: Array<{ id: KanbanView; label: string }> = [
    { id: "active", label: "Active funnel" },
    { id: "settled", label: "Settled" },
    { id: "all", label: "All" },
  ];
  return (
    <div className="inline-flex border border-forest/15 bg-white">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "font-heading text-[0.7rem] uppercase tracking-[0.12em] px-3 py-1.5",
            view === t.id
              ? "bg-forest text-gold"
              : "text-tofino hover:text-forest hover:bg-off-white",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  matchCount,
}: {
  value: string;
  onChange: (v: string) => void;
  matchCount: number | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name or email…"
        className="text-sm px-3 py-1.5 border border-forest/15 bg-white focus:outline-none focus:border-gold w-56"
      />
      {matchCount != null && (
        <span className="text-xs text-tofino italic">
          {matchCount} match{matchCount === 1 ? "" : "es"}
        </span>
      )}
    </div>
  );
}

function KanbanColumn({
  stage,
  leads,
  tone,
  interactive,
}: {
  stage: LeadStage;
  leads: KanbanLeadRow[];
  tone: string;
  interactive: boolean;
}) {
  return interactive ? (
    <DroppableColumn stage={stage} leads={leads} tone={tone} />
  ) : (
    <ColumnShell stage={stage} leads={leads} tone={tone} interactive={false} />
  );
}

function DroppableColumn({
  stage,
  leads,
  tone,
}: {
  stage: LeadStage;
  leads: KanbanLeadRow[];
  tone: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <ColumnShell
      ref={setNodeRef}
      stage={stage}
      leads={leads}
      tone={tone}
      isOver={isOver}
      interactive
    />
  );
}

function ColumnShell({
  stage,
  leads,
  tone,
  isOver = false,
  interactive,
  ref,
}: {
  stage: LeadStage;
  leads: KanbanLeadRow[];
  tone: string;
  isOver?: boolean;
  interactive: boolean;
  ref?: (node: HTMLElement | null) => void;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col bg-off-white/60 border-t-2 min-w-[240px]",
        tone,
        isOver && "bg-gold/10",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-forest/8">
        <h2 className="font-heading text-[0.72rem] uppercase tracking-[0.12em] text-forest truncate">
          {STAGE_LABELS[stage]}
        </h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-heading text-xs text-tofino">
            {leads.length}
          </span>
          <Link
            href={`/admin/stages/${stage}`}
            className="text-tofino/60 hover:text-gold text-base leading-none"
            title={`Edit ${STAGE_LABELS[stage]} automations`}
          >
            ⚙
          </Link>
        </div>
      </header>
      <div className="flex-1 px-2 py-2 space-y-2 min-h-[120px]">
        {leads.length === 0 ? (
          <p className="text-xs italic text-tofino/60 text-center px-3 py-6">
            {emptyText(stage)}
          </p>
        ) : (
          leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              draggable={interactive}
            />
          ))
        )}
      </div>
    </div>
  );
}

function emptyText(stage: LeadStage): string {
  switch (stage) {
    case "new":
      return "Fresh leads from the form/booking modal land here.";
    case "stale":
      return "Move leads here once they've gone cold.";
    case "booked_a_call":
      return "Discovery calls scheduled show here.";
    case "call_completed":
      return "Move leads here after the discovery call.";
    case "video_shoot_scheduled":
      return "Move leads here once the shoot is booked.";
    case "post_video_shoot":
      return "Move leads here after the shoot wraps.";
    case "closed":
      return "Drop or move leads here once paid.";
    case "lost":
      return "Drop or move leads here when they don't convert.";
  }
}
