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
import { toast } from "sonner";
import { setLeadStage } from "@/app/admin/actions";
import { KanbanCard, type KanbanLeadRow } from "./kanban-card";
import { showStageMoveToast } from "./move-toast";
import { AddStageButton, EditStageButton } from "./stage-editor";
import {
  splitBoardViews,
  stagePalette,
  type StageRow,
  type StageSettings,
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

export function KanbanBoard({
  leads,
  stages,
  settings,
}: {
  leads: KanbanLeadRow[];
  stages: StageRow[];
  settings: StageSettings;
}) {
  // dnd-kit allocates internal IDs (DndDescribedBy-N) using a module-level
  // counter that diverges between SSR and client renders. Gating the
  // interactive tree behind a mount flag lets the server emit the static
  // layout and the client take over once hydrated, avoiding aria-describedby
  // hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [optimistic, applyOptimistic] = useOptimistic(
    leads,
    (state, update: { id: string; stageId: string }) =>
      state.map((l) =>
        l.id === update.id ? { ...l, stageId: update.stageId } : l,
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

  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const stageById = new Map(ordered.map((s) => [s.id, s]));
  const bookingStagePosition =
    stageById.get(settings.bookingStageId)?.position ?? -1;

  // Unfiltered per-stage totals: the delete flow needs the stage's true
  // resident count even while a search narrows the visible cards.
  const totalLeadCounts = new Map<string, number>();
  for (const lead of optimistic) {
    totalLeadCounts.set(
      lead.stageId,
      (totalLeadCounts.get(lead.stageId) ?? 0) + 1,
    );
  }

  const grouped = new Map<string, KanbanLeadRow[]>(
    ordered.map((s) => [s.id, []]),
  );
  for (const lead of optimistic) {
    if (!leadMatchesQuery(lead, query)) continue;
    const bucket = grouped.get(lead.stageId);
    if (bucket) {
      bucket.push(lead);
    } else {
      // Unknown stage id (e.g. data outracing a stale board) — surface it so
      // it isn't silently lost, then bucket into the Entry Stage column.
      console.warn(
        `[kanban] Lead ${lead.id} has unknown stage '${lead.stageId}', falling back to the Entry Stage.`,
      );
      grouped.get(settings.entryStageId)?.push(lead);
    }
  }

  const views = splitBoardViews(ordered);
  const stagesShown =
    view === "active"
      ? views.active
      : view === "settled"
        ? views.settled
        : ordered;

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

    const targetStageId = String(overId);
    const targetStage = stageById.get(targetStageId);
    if (!targetStage) return;

    const lead = optimistic.find((l) => l.id === leadId);
    if (!lead || lead.stageId === targetStageId) return;

    startTransition(async () => {
      applyOptimistic({ id: leadId, stageId: targetStageId });
      try {
        const move = await setLeadStage(leadId, targetStageId);
        showStageMoveToast({ leadId, stageName: targetStage.name, move });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't move the lead.",
        );
      }
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
    <div className="overflow-x-auto pb-2">
      <div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-3 min-w-max">
        {stagesShown.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            allStages={ordered}
            leads={grouped.get(stage.id) ?? []}
            totalLeadCount={totalLeadCounts.get(stage.id) ?? 0}
            settings={settings}
            bookingStagePosition={bookingStagePosition}
            interactive={mounted}
          />
        ))}
        <AddStageButton stages={ordered} />
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
          {draggingLead ? (
            <KanbanCard
              lead={draggingLead}
              stage={stageById.get(draggingLead.stageId)}
              settings={settings}
              bookingStagePosition={bookingStagePosition}
              isOverlay
            />
          ) : null}
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
    <div className="inline-flex border border-(--adm-border) bg-(--adm-surface)">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "font-heading text-[0.7rem] uppercase tracking-[0.12em] px-3 py-1.5",
            view === t.id
              ? "bg-forest text-gold"
              : "text-(--adm-text-muted) hover:text-(--adm-text) hover:bg-(--adm-hover)",
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
        className="text-sm px-3 py-1.5 border border-(--adm-border) bg-(--adm-surface) text-(--adm-text) placeholder:text-(--adm-text-muted) focus:outline-none focus:border-gold w-full sm:w-56"
      />
      {matchCount != null && (
        <span className="text-xs text-(--adm-text-muted)">
          {matchCount} match{matchCount === 1 ? "" : "es"}
        </span>
      )}
    </div>
  );
}

function KanbanColumn({
  stage,
  allStages,
  leads,
  totalLeadCount,
  settings,
  bookingStagePosition,
  interactive,
}: {
  stage: StageRow;
  allStages: StageRow[];
  leads: KanbanLeadRow[];
  totalLeadCount: number;
  settings: StageSettings;
  bookingStagePosition: number;
  interactive: boolean;
}) {
  return interactive ? (
    <DroppableColumn
      stage={stage}
      allStages={allStages}
      leads={leads}
      totalLeadCount={totalLeadCount}
      settings={settings}
      bookingStagePosition={bookingStagePosition}
    />
  ) : (
    <ColumnShell
      stage={stage}
      allStages={allStages}
      leads={leads}
      totalLeadCount={totalLeadCount}
      settings={settings}
      bookingStagePosition={bookingStagePosition}
      interactive={false}
    />
  );
}

function DroppableColumn({
  stage,
  allStages,
  leads,
  totalLeadCount,
  settings,
  bookingStagePosition,
}: {
  stage: StageRow;
  allStages: StageRow[];
  leads: KanbanLeadRow[];
  totalLeadCount: number;
  settings: StageSettings;
  bookingStagePosition: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <ColumnShell
      ref={setNodeRef}
      stage={stage}
      allStages={allStages}
      leads={leads}
      totalLeadCount={totalLeadCount}
      settings={settings}
      bookingStagePosition={bookingStagePosition}
      isOver={isOver}
      interactive
    />
  );
}

function ColumnShell({
  stage,
  allStages,
  leads,
  totalLeadCount,
  settings,
  bookingStagePosition,
  isOver = false,
  interactive,
  ref,
}: {
  stage: StageRow;
  allStages: StageRow[];
  leads: KanbanLeadRow[];
  totalLeadCount: number;
  settings: StageSettings;
  bookingStagePosition: number;
  isOver?: boolean;
  interactive: boolean;
  ref?: (node: HTMLElement | null) => void;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col bg-(--adm-surface-2) border-t-2 min-w-[240px]",
        stagePalette(stage.color).tone,
        isOver && "bg-gold/10",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-(--adm-border)">
        <h2 className="font-heading text-[0.72rem] uppercase tracking-[0.12em] text-(--adm-text) truncate">
          {stage.name}
        </h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-heading text-xs text-(--adm-text-muted)">
            {leads.length}
          </span>
          <EditStageButton
            stage={stage}
            stages={allStages}
            settings={settings}
            leadCount={totalLeadCount}
          />
          <Link
            href={`/admin/stages/${stage.id}`}
            className="text-(--adm-text-muted) hover:text-gold text-base leading-none"
            title={`Edit ${stage.name} automations`}
          >
            ⚙
          </Link>
        </div>
      </header>
      <div className="flex-1 px-2 py-2 space-y-2 min-h-[120px]">
        {leads.length === 0 ? (
          <p className="text-xs text-(--adm-text-muted) text-center px-3 py-6">
            {stage.description ?? "No leads here yet."}
          </p>
        ) : (
          leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              stage={stage}
              settings={settings}
              bookingStagePosition={bookingStagePosition}
              draggable={interactive}
            />
          ))
        )}
      </div>
    </div>
  );
}
