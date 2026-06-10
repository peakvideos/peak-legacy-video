"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createStage,
  recolorStage,
  renameStage,
  reorderStages,
} from "@/app/admin/stages/actions";
import {
  STAGE_COLORS,
  stagePalette,
  type StageRow,
} from "@/lib/admin/stages";
import { cn } from "@/lib/utils";
import { useAdminTheme } from "./admin-theme";

const LABEL = "text-xs font-heading uppercase tracking-[0.14em] text-(--adm-text-muted)";
const INPUT =
  "w-full text-base px-3 py-2 border border-(--adm-border) bg-(--adm-surface) text-(--adm-text) focus:outline-none focus:border-gold";

/**
 * Position choices are insertion points into `slots` (the board order,
 * excluding the stage being edited): index 0 is "First", index i+1 is
 * "After slots[i]".
 */
function PositionSelect({
  slots,
  value,
  onChange,
  disabled,
}: {
  slots: StageRow[];
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={INPUT}
    >
      <option value={0}>First</option>
      {slots.map((s, i) => (
        <option key={s.id} value={i + 1}>
          After {s.name}
        </option>
      ))}
    </select>
  );
}

function ColorSwatches({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {STAGE_COLORS.map((key) => (
        <button
          key={key}
          type="button"
          title={key}
          disabled={disabled}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "h-7 w-7 border border-(--adm-border)",
            stagePalette(key).button.active,
            value === key
              ? "ring-2 ring-gold ring-offset-2 ring-offset-(--adm-surface)"
              : "opacity-70 hover:opacity-100",
          )}
        />
      ))}
    </div>
  );
}

function StageDialog({
  trigger,
  title,
  open,
  onOpenChange,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const { theme } = useAdminTheme();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className={cn(
          "admin-shell !max-w-md gap-0 p-0 overflow-hidden border-t-4 border-gold bg-(--adm-surface) text-(--adm-text)",
          theme === "dark" && "dark",
        )}
      >
        <DialogHeader className="px-6 py-3 border-b border-(--adm-border)">
          <DialogTitle className="font-heading text-(--adm-text)">
            {title}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** The board's affordance for adding a stage at a chosen position. */
export function AddStageButton({ stages }: { stages: StageRow[] }) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(STAGE_COLORS[0]);
  const [position, setPosition] = useState(ordered.length);
  const [pending, startTransition] = useTransition();

  const openWithDefaults = (next: boolean) => {
    if (next) {
      setName("");
      setColor(STAGE_COLORS[0]);
      setPosition(ordered.length);
    }
    setOpen(next);
  };

  const save = () => {
    startTransition(async () => {
      try {
        await createStage({ name, color, position });
        toast.success(`Added "${name.trim()}"`);
        setOpen(false);
      } catch {
        toast.error("Couldn't add the stage.");
      }
    });
  };

  return (
    <StageDialog
      open={open}
      onOpenChange={openWithDefaults}
      title="Add a stage"
      trigger={
        <button
          type="button"
          className="min-w-[240px] min-h-[160px] border border-dashed border-(--adm-border-strong) font-heading text-[0.72rem] uppercase tracking-[0.12em] text-(--adm-text-muted) hover:text-gold hover:border-gold"
        >
          + Add stage
        </button>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <div className="space-y-2">
          <label className={LABEL}>Name</label>
          <input
            type="text"
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Contract sent"
            className={INPUT}
          />
        </div>
        <div className="space-y-2">
          <label className={LABEL}>Color</label>
          <ColorSwatches value={color} onChange={setColor} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label className={LABEL}>Position</label>
          <PositionSelect
            slots={ordered}
            value={position}
            onChange={setPosition}
            disabled={pending}
          />
        </div>
      </div>
      <footer className="px-6 py-3 border-t border-(--adm-border) bg-(--adm-surface-2) flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="font-heading text-xs uppercase tracking-[0.14em] px-3 py-2 text-(--adm-text-muted) hover:text-(--adm-text)"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={save}
          className="font-heading text-xs uppercase tracking-[0.14em] px-4 py-2 bg-forest text-white hover:bg-forest-deep disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add stage
        </button>
      </footer>
    </StageDialog>
  );
}

/** Column-header dialog: rename, recolor, and reposition one stage. */
export function EditStageButton({
  stage,
  stages,
}: {
  stage: StageRow;
  stages: StageRow[];
}) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const slots = ordered.filter((s) => s.id !== stage.id);
  const currentIndex = ordered.findIndex((s) => s.id === stage.id);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);
  const [position, setPosition] = useState(currentIndex);
  const [pending, startTransition] = useTransition();

  const openWithCurrent = (next: boolean) => {
    if (next) {
      setName(stage.name);
      setColor(stage.color);
      setPosition(currentIndex);
    }
    setOpen(next);
  };

  const save = () => {
    startTransition(async () => {
      try {
        if (name.trim() !== stage.name) {
          await renameStage(stage.id, name);
        }
        if (color !== stage.color) {
          await recolorStage(stage.id, color);
        }
        if (position !== currentIndex) {
          const ids = slots.map((s) => s.id);
          ids.splice(position, 0, stage.id);
          await reorderStages(ids);
        }
        toast.success(`Saved "${name.trim()}"`);
        setOpen(false);
      } catch {
        toast.error("Couldn't save the stage.");
      }
    });
  };

  return (
    <StageDialog
      open={open}
      onOpenChange={openWithCurrent}
      title={`Edit ${stage.name}`}
      trigger={
        <button
          type="button"
          title={`Edit ${stage.name}`}
          className="text-(--adm-text-muted) hover:text-gold text-base leading-none"
        >
          ✎
        </button>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <div className="space-y-2">
          <label className={LABEL}>Name</label>
          <input
            type="text"
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            className={INPUT}
          />
        </div>
        <div className="space-y-2">
          <label className={LABEL}>Color</label>
          <ColorSwatches value={color} onChange={setColor} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label className={LABEL}>Position</label>
          <PositionSelect
            slots={slots}
            value={position}
            onChange={setPosition}
            disabled={pending}
          />
        </div>
      </div>
      <footer className="px-6 py-3 border-t border-(--adm-border) bg-(--adm-surface-2) flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="font-heading text-xs uppercase tracking-[0.14em] px-3 py-2 text-(--adm-text-muted) hover:text-(--adm-text)"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={save}
          className="font-heading text-xs uppercase tracking-[0.14em] px-4 py-2 bg-forest text-white hover:bg-forest-deep disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </footer>
    </StageDialog>
  );
}
