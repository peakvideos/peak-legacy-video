"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  addAutomation,
  removeAutomation,
  reorderAutomations,
  updateAutomation,
} from "./actions";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { LeadStage } from "@/lib/email/sequence";
import { cn } from "@/lib/utils";

type Automation = {
  id: string;
  templateId: string;
  delayMinutes: number;
  templateName: string;
  templateSubject: string;
  templateSlug: string;
};

type AvailableTemplate = {
  id: string;
  name: string;
  subject: string;
  slug: string;
};

export function StageAutomationsEditor({
  stage,
  automations,
  availableTemplates,
}: {
  stage: LeadStage;
  automations: Automation[];
  availableTemplates: AvailableTemplate[];
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-heading uppercase tracking-[0.14em] text-xs text-(--adm-text-muted)">
          Automations ({automations.length})
        </h2>
        {automations.length === 0 ? (
          <p className="bg-(--adm-surface) border border-(--adm-border) p-6 text-sm text-(--adm-text-muted)">
            No automations yet. Add one below to start nurturing leads who
            land in this stage.
          </p>
        ) : (
          <SortableAutomationList stage={stage} automations={automations} />
        )}
      </section>

      <AddAutomationForm
        stage={stage}
        availableTemplates={availableTemplates}
      />
    </div>
  );
}

function SortableAutomationList({
  stage,
  automations,
}: {
  stage: LeadStage;
  automations: Automation[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [optimistic, applyOptimistic] = useOptimistic(
    automations,
    (state, orderedIds: string[]) => {
      const byId = new Map(state.map((a) => [a.id, a]));
      const next: Automation[] = [];
      for (const id of orderedIds) {
        const row = byId.get(id);
        if (row) next.push(row);
      }
      return next;
    },
  );
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = optimistic.findIndex((a) => a.id === event.active.id);
    const newIndex = optimistic.findIndex((a) => a.id === event.over!.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(optimistic, oldIndex, newIndex);
    const orderedIds = reordered.map((a) => a.id);
    startTransition(async () => {
      applyOptimistic(orderedIds);
      await reorderAutomations({ stage, orderedIds });
    });
  };

  // Static fallback while not mounted — keeps SSR clean. Cards still render
  // and remain editable.
  if (!mounted) {
    return (
      <ul className="bg-(--adm-surface) border border-(--adm-border) divide-y divide-(--adm-border)">
        {optimistic.map((a) => (
          <AutomationRow
            key={a.id}
            stage={stage}
            automation={a}
            sortable={false}
          />
        ))}
      </ul>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleEnd}>
      <SortableContext
        items={optimistic.map((a) => a.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="bg-(--adm-surface) border border-(--adm-border) divide-y divide-(--adm-border)">
          {optimistic.map((a) => (
            <AutomationRow
              key={a.id}
              stage={stage}
              automation={a}
              sortable
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function AutomationRow({
  stage,
  automation,
  sortable,
}: {
  stage: LeadStage;
  automation: Automation;
  sortable: boolean;
}) {
  const sortableHandle = useSortable({
    id: automation.id,
    disabled: !sortable,
  });

  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [delay, setDelay] = useState(formatDelay(automation.delayMinutes));
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDelay(formatDelay(automation.delayMinutes));
    setEditing(false);
    setError(null);
  };

  const save = () => {
    setError(null);
    const minutes = parseDelay(delay);
    if (minutes == null) {
      setError("Use a number followed by m/h/d (e.g. 5m, 2h, 3d).");
      return;
    }
    startTransition(async () => {
      try {
        await updateAutomation({
          id: automation.id,
          stage,
          delayMinutes: minutes,
        });
        setEditing(false);
        toast.success("Delay updated");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save.";
        setError(msg);
        toast.error(msg);
      }
    });
  };

  const style = sortable
    ? {
        transform: CSS.Transform.toString(sortableHandle.transform),
        transition: sortableHandle.transition,
      }
    : undefined;

  return (
    <li
      ref={sortable ? sortableHandle.setNodeRef : undefined}
      style={style}
      className={cn(
        "px-4 py-3 flex items-center gap-3 flex-wrap bg-(--adm-surface)",
        sortableHandle.isDragging && "opacity-60 shadow-md z-10",
      )}
    >
      {sortable && (
        <button
          type="button"
          aria-label="Drag to reorder"
          {...sortableHandle.attributes}
          {...sortableHandle.listeners}
          className="cursor-grab active:cursor-grabbing text-(--adm-text-muted) hover:text-(--adm-text) text-base leading-none touch-none"
        >
          ⋮⋮
        </button>
      )}
      <div className="flex-1 min-w-0">
        <Link
          href={`/admin/settings/templates/${automation.templateId}`}
          className="font-heading text-(--adm-text) text-sm hover:text-gold"
        >
          {automation.templateName}
        </Link>
        <p className="text-xs text-(--adm-text-muted) truncate">
          {automation.templateSubject}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <input
              autoFocus
              type="text"
              value={delay}
              onChange={(e) => setDelay(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                } else if (e.key === "Escape") {
                  reset();
                }
              }}
              className="text-sm px-2 py-1 bg-(--adm-surface) text-(--adm-text) border border-(--adm-border-strong) focus:outline-none focus:border-gold w-24"
              placeholder="5m / 1d"
            />
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="text-xs font-heading uppercase tracking-wider px-2 py-1 bg-forest text-white hover:bg-forest-deep disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="text-xs text-(--adm-text-muted) hover:text-(--adm-text) px-1"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-heading text-(--adm-text-muted) tabular-nums">
              after {formatDelayLabel(automation.delayMinutes)}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-heading uppercase tracking-wider text-(--adm-text-muted) hover:text-gold"
            >
              edit
            </button>
            <ConfirmDialog
              title="Remove automation?"
              description={`"${automation.templateName}" will be detached from this stage and any queued sends will be cancelled.`}
              confirmLabel="Remove"
              destructive
              onConfirm={async () => {
                await removeAutomation({ id: automation.id, stage });
                toast.success("Automation removed");
              }}
              trigger={
                <button
                  type="button"
                  disabled={pending}
                  className="text-xs font-heading uppercase tracking-wider text-blush hover:text-(--adm-text) disabled:opacity-50"
                >
                  remove
                </button>
              }
            />
          </>
        )}
      </div>
      {error && (
        <p className="basis-full text-xs text-blush">{error}</p>
      )}
    </li>
  );
}

function AddAutomationForm({
  stage,
  availableTemplates,
}: {
  stage: LeadStage;
  availableTemplates: AvailableTemplate[];
}) {
  const [pending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState<string>("");
  const [delay, setDelay] = useState("0m");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!templateId) {
      setError("Pick a template.");
      return;
    }
    const minutes = parseDelay(delay);
    if (minutes == null) {
      setError("Use a number followed by m/h/d (e.g. 5m, 2h, 3d).");
      return;
    }
    startTransition(async () => {
      try {
        await addAutomation({ stage, templateId, delayMinutes: minutes });
        setTemplateId("");
        setDelay("0m");
        toast.success("Automation added");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to add.";
        setError(msg);
        toast.error(msg);
      }
    });
  };

  if (availableTemplates.length === 0) {
    return (
      <div className="bg-(--adm-surface-2) border border-(--adm-border) p-4 text-xs text-(--adm-text-muted)">
        Every active template is already attached to this stage. Create more
        in{" "}
        <Link
          href="/admin/settings/templates"
          className="underline hover:text-(--adm-text)"
        >
          /admin/settings/templates
        </Link>
        .
      </div>
    );
  }

  return (
    <section className="bg-(--adm-surface) border border-(--adm-border) p-4 space-y-2">
      <h2 className="font-heading uppercase tracking-[0.14em] text-xs text-(--adm-text-muted)">
        Add automation
      </h2>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          disabled={pending}
          className="text-sm px-3 py-2 border border-(--adm-border-strong) bg-(--adm-surface) text-(--adm-text) focus:outline-none focus:border-gold flex-1 min-w-[240px]"
        >
          <option value="">Pick a template…</option>
          {availableTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={delay}
          onChange={(e) => setDelay(e.target.value)}
          disabled={pending}
          placeholder="5m / 1d / 2h"
          className="text-sm px-3 py-2 border border-(--adm-border-strong) bg-(--adm-surface) text-(--adm-text) focus:outline-none focus:border-gold w-32"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="font-heading text-xs uppercase tracking-[0.14em] px-3 py-2 bg-forest text-white hover:bg-forest-deep disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="text-xs text-blush">{error}</p>}
    </section>
  );
}

const DELAY_RE = /^\s*(\d+(?:\.\d+)?)\s*([mhd])\s*$/i;

function parseDelay(input: string): number | null {
  const m = DELAY_RE.exec(input);
  if (!m) {
    const n = Number(input.trim());
    if (Number.isFinite(n) && n >= 0) return n;
    return null;
  }
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(value) || value < 0) return null;
  if (unit === "m") return value;
  if (unit === "h") return value * 60;
  if (unit === "d") return value * 60 * 24;
  return null;
}

function formatDelay(minutes: number): string {
  if (minutes === 0) return "0m";
  if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function formatDelayLabel(minutes: number): string {
  if (minutes === 0) return "immediately";
  const days = minutes / (60 * 24);
  if (Number.isInteger(days) && days >= 1) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  const hours = minutes / 60;
  if (Number.isInteger(hours) && hours >= 1) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} min`;
}
