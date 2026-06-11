"use client";

import {
  useEffect,
  useOptimistic,
  useState,
  useTransition,
} from "react";
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
  DELAY_FORMAT_HINT,
  formatDelay,
  formatDelayPhrase,
  parseDelay,
} from "@/lib/admin/delay";
import {
  addAutomation,
  createTemplateAndAttach,
  removeAutomation,
  reorderAutomations,
  updateAutomation,
} from "./actions";
import { useTemplateEditor } from "./template-editor-sheet";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { cn } from "@/lib/utils";

type Card = {
  id: string;
  templateId: string;
  templateName: string;
  templateSubject: string;
  delayMinutes: number;
};

type PickableTemplate = {
  id: string;
  name: string;
  subject: string;
};

export function JourneyStageColumn({
  stage,
  cards,
  templates,
  toneClass,
}: {
  stage: { id: string; name: string };
  cards: Card[];
  /** Every active template; the picker filters out ones already attached here. */
  templates: PickableTemplate[];
  toneClass: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [optimistic, applyOptimistic] = useOptimistic(
    cards,
    (state, orderedIds: string[]) => {
      const byId = new Map(state.map((c) => [c.id, c]));
      const dragged = orderedIds
        .map((id) => byId.get(id))
        .filter((c): c is Card => Boolean(c));
      // Cards settle straight into send order: delay decides, the dragged
      // order breaks ties — the same derivation the server persists.
      return dragged.sort((a, b) => a.delayMinutes - b.delayMinutes);
    },
  );
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = optimistic.findIndex((c) => c.id === event.active.id);
    const newIndex = optimistic.findIndex((c) => c.id === event.over!.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const orderedIds = arrayMove(optimistic, oldIndex, newIndex).map(
      (c) => c.id,
    );
    startTransition(async () => {
      applyOptimistic(orderedIds);
      await reorderAutomations({ stage: stage.id, orderedIds });
    });
  };

  const attachedTemplateIds = new Set(optimistic.map((c) => c.templateId));
  const available = templates.filter((t) => !attachedTemplateIds.has(t.id));

  const cardList = optimistic.map((c) => (
    <JourneyCardRow key={c.id} stage={stage} card={c} sortable={mounted} />
  ));

  return (
    <section
      id={`stage-${stage.id}`}
      className={`flex flex-col bg-(--adm-surface-2) border-t-2 min-w-[300px] w-[300px] shrink-0 scroll-mt-6 ${toneClass}`}
    >
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-(--adm-border)">
        <h2 className="font-heading text-[0.72rem] uppercase tracking-[0.12em] text-(--adm-text) truncate">
          {stage.name}
        </h2>
        <span className="font-heading text-xs text-(--adm-text-muted) shrink-0">
          {optimistic.length}
        </span>
      </header>
      <div className="flex-1 px-2 py-2 space-y-2 min-h-[120px]">
        {optimistic.length === 0 ? (
          <p className="text-xs text-(--adm-text-muted) text-center px-3 py-6">
            No automated emails.
          </p>
        ) : mounted ? (
          <DndContext sensors={sensors} onDragEnd={handleEnd}>
            <SortableContext
              items={optimistic.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {cardList}
            </SortableContext>
          </DndContext>
        ) : (
          cardList
        )}
      </div>
      <AddEmailPanel stage={stage} available={available} />
    </section>
  );
}

function JourneyCardRow({
  stage,
  card,
  sortable,
}: {
  stage: { id: string; name: string };
  card: Card;
  sortable: boolean;
}) {
  const sortableHandle = useSortable({ id: card.id, disabled: !sortable });

  const { openTemplate } = useTemplateEditor();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [delay, setDelay] = useState("");
  const [error, setError] = useState<string | null>(null);

  const beginEdit = () => {
    setDelay(formatDelay(card.delayMinutes));
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const save = () => {
    setError(null);
    const minutes = parseDelay(delay);
    if (minutes == null) {
      setError(DELAY_FORMAT_HINT);
      return;
    }
    startTransition(async () => {
      try {
        await updateAutomation({
          id: card.id,
          stage: stage.id,
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
    <div
      ref={sortable ? sortableHandle.setNodeRef : undefined}
      style={style}
      className={cn(
        "bg-(--adm-surface) border border-(--adm-border) px-3 py-2.5 space-y-1.5",
        sortableHandle.isDragging && "opacity-60 shadow-md z-10 relative",
      )}
    >
      <div className="flex items-start gap-2">
        {sortable && (
          <button
            type="button"
            aria-label="Drag to reorder"
            {...sortableHandle.attributes}
            {...sortableHandle.listeners}
            className="cursor-grab active:cursor-grabbing text-(--adm-text-muted) hover:text-(--adm-text) text-base leading-none touch-none mt-0.5"
          >
            ⋮⋮
          </button>
        )}
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => openTemplate(card.templateId)}
            title="Edit template"
            className="block w-full text-left text-sm text-(--adm-text) truncate hover:text-gold"
          >
            {card.templateName}
          </button>
          <p className="text-xs text-(--adm-text-muted) truncate">
            {card.templateSubject}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <span className="flex items-center gap-1.5 flex-wrap">
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
                  cancelEdit();
                }
              }}
              disabled={pending}
              className="text-xs px-2 py-1 bg-(--adm-surface) text-(--adm-text) border border-(--adm-border-strong) focus:outline-none focus:border-gold w-20"
              placeholder="5m / 1d"
            />
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="text-[0.65rem] font-heading uppercase tracking-wider px-2 py-1 bg-forest text-white hover:bg-forest-deep disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={pending}
              className="text-[0.65rem] text-(--adm-text-muted) hover:text-(--adm-text)"
            >
              Cancel
            </button>
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={beginEdit}
              title="Edit delay"
              className="font-heading text-[0.65rem] uppercase tracking-[0.1em] text-gold hover:text-gold-light"
            >
              {formatDelayPhrase(card.delayMinutes)} ✎
            </button>
            <ConfirmDialog
              title="Detach email?"
              description={`"${card.templateName}" will stop sending from ${stage.name} and any queued sends for leads in this stage will be cancelled. The template is kept on the Unattached shelf for reuse.`}
              confirmLabel="Detach"
              destructive
              onConfirm={async () => {
                await removeAutomation({ id: card.id, stage: stage.id });
                toast.success("Email detached — template kept");
              }}
              trigger={
                <button
                  type="button"
                  disabled={pending}
                  className="text-[0.65rem] font-heading uppercase tracking-wider text-blush hover:text-(--adm-text) disabled:opacity-50"
                >
                  detach
                </button>
              }
            />
          </>
        )}
      </div>
      {error && <p className="text-xs text-blush">{error}</p>}
    </div>
  );
}

function AddEmailPanel({
  stage,
  available,
}: {
  stage: { id: string; name: string };
  available: PickableTemplate[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [pending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState("");
  const [delay, setDelay] = useState("0m");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setMode("pick");
    setTemplateId("");
    setDelay("0m");
    setName("");
    setSubject("");
    setBody("");
    setError(null);
  };

  const submit = () => {
    setError(null);
    const minutes = parseDelay(delay);
    if (minutes == null) {
      setError(DELAY_FORMAT_HINT);
      return;
    }
    if (mode === "pick" && !templateId) {
      setError("Pick a template.");
      return;
    }
    startTransition(async () => {
      try {
        if (mode === "pick") {
          await addAutomation({
            stage: stage.id,
            templateId,
            delayMinutes: minutes,
          });
          toast.success("Email added");
        } else {
          await createTemplateAndAttach({
            stage: stage.id,
            name,
            subject,
            body,
            delayMinutes: minutes,
          });
          toast.success("Email created and added");
        }
        close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to add.";
        setError(msg);
        toast.error(msg);
      }
    });
  };

  if (!open) {
    return (
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-xs font-heading uppercase tracking-[0.14em] text-(--adm-text-muted) hover:text-gold border border-dashed border-(--adm-border) hover:border-gold px-3 py-2"
        >
          + Add email
        </button>
      </div>
    );
  }

  const fieldClass =
    "w-full text-xs px-2 py-1.5 bg-(--adm-surface) text-(--adm-text) border border-(--adm-border-strong) focus:outline-none focus:border-gold";

  return (
    <div className="mx-2 mb-2 bg-(--adm-surface) border border-(--adm-border) p-2.5 space-y-2">
      <div className="flex items-center gap-1">
        {(["pick", "create"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              "flex-1 text-[0.65rem] font-heading uppercase tracking-wider px-2 py-1 border",
              mode === m
                ? "border-gold text-gold"
                : "border-(--adm-border) text-(--adm-text-muted) hover:text-(--adm-text)",
            )}
          >
            {m === "pick" ? "Pick existing" : "Write new"}
          </button>
        ))}
      </div>

      {mode === "pick" ? (
        available.length === 0 ? (
          <p className="text-xs text-(--adm-text-muted)">
            Every active template is already attached here — write a new one
            instead.
          </p>
        ) : (
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={pending}
            className={fieldClass}
          >
            <option value="">Pick a template…</option>
            {available.map((t) => (
              <option key={t.id} value={t.id} title={t.subject}>
                {t.name}
              </option>
            ))}
          </select>
        )
      ) : (
        <>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            placeholder="Template name"
            className={fieldClass}
          />
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={pending}
            placeholder="Subject — {{firstName}} works here"
            className={fieldClass}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={pending}
            placeholder={"Write the email…\nEach line becomes a paragraph."}
            rows={5}
            className={fieldClass}
          />
        </>
      )}

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={delay}
          onChange={(e) => setDelay(e.target.value)}
          disabled={pending}
          placeholder="5m / 2h / 3d"
          title="Delay after a lead enters the stage"
          className={cn(fieldClass, "w-24 flex-none")}
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || (mode === "pick" && available.length === 0)}
          className="flex-1 text-[0.65rem] font-heading uppercase tracking-wider px-2 py-1.5 bg-forest text-white hover:bg-forest-deep disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={close}
          disabled={pending}
          className="text-[0.65rem] text-(--adm-text-muted) hover:text-(--adm-text) px-1"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-blush">{error}</p>}
    </div>
  );
}
