"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { StageRow } from "@/lib/admin/stages";
import { updatePipelineSettings } from "./actions";

const LABEL =
  "text-xs font-heading uppercase tracking-[0.14em] text-(--adm-text-muted)";
const SELECT =
  "w-full text-base px-3 py-2 border border-(--adm-border) bg-(--adm-surface) text-(--adm-text) focus:outline-none focus:border-gold";

function StagePointerField({
  label,
  help,
  stages,
  value,
  onChange,
  disabled,
}: {
  label: string;
  help: string;
  stages: StageRow[];
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className={LABEL}>{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-(--adm-text-muted)">{help}</p>
    </div>
  );
}

export function PipelineSettingsForm({
  stages,
  entryStageId,
  bookingStageId,
}: {
  stages: StageRow[];
  entryStageId: string;
  bookingStageId: string;
}) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const [saved, setSaved] = useState({ entryStageId, bookingStageId });
  const [entryId, setEntryId] = useState(entryStageId);
  const [bookingId, setBookingId] = useState(bookingStageId);
  const [pending, startTransition] = useTransition();

  const dirty =
    entryId !== saved.entryStageId || bookingId !== saved.bookingStageId;

  const save = () => {
    startTransition(async () => {
      try {
        await updatePipelineSettings({
          entryStageId: entryId,
          bookingStageId: bookingId,
        });
        setSaved({ entryStageId: entryId, bookingStageId: bookingId });
        toast.success("Pipeline settings saved");
      } catch {
        toast.error("Couldn't save the pipeline settings.");
      }
    });
  };

  return (
    <section className="bg-(--adm-surface) border border-(--adm-border) max-w-xl">
      <div className="px-6 py-5 space-y-5">
        <StagePointerField
          label="Entry stage"
          help="New inquiries land here and receive this stage's automated emails."
          stages={ordered}
          value={entryId}
          onChange={setEntryId}
          disabled={pending}
        />
        <StagePointerField
          label="Booking stage"
          help="A lead who books a call is promoted here. Promotion only moves leads forward, never back."
          stages={ordered}
          value={bookingId}
          onChange={setBookingId}
          disabled={pending}
        />
      </div>
      <footer className="px-6 py-3 border-t border-(--adm-border) bg-(--adm-surface-2) flex items-center justify-end">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={save}
          className="font-heading text-xs uppercase tracking-[0.14em] px-4 py-2 bg-forest text-white hover:bg-forest-deep disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </footer>
    </section>
  );
}
