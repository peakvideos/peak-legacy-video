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
  coldThresholdDays,
}: {
  stages: StageRow[];
  entryStageId: string;
  bookingStageId: string;
  coldThresholdDays: number;
}) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const [saved, setSaved] = useState({
    entryStageId,
    bookingStageId,
    coldDays: String(coldThresholdDays),
  });
  const [entryId, setEntryId] = useState(entryStageId);
  const [bookingId, setBookingId] = useState(bookingStageId);
  const [coldDays, setColdDays] = useState(String(coldThresholdDays));
  const [pending, startTransition] = useTransition();

  const coldDaysNumber = Number(coldDays);
  const coldDaysValid = Number.isInteger(coldDaysNumber) && coldDaysNumber >= 1;

  const dirty =
    entryId !== saved.entryStageId ||
    bookingId !== saved.bookingStageId ||
    coldDays !== saved.coldDays;

  const save = () => {
    startTransition(async () => {
      try {
        await updatePipelineSettings({
          entryStageId: entryId,
          bookingStageId: bookingId,
          coldThresholdDays: coldDaysNumber,
        });
        setSaved({ entryStageId: entryId, bookingStageId: bookingId, coldDays });
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
        <div className="space-y-2">
          <label className={LABEL} htmlFor="cold-threshold-days">
            Cold threshold (days)
          </label>
          <input
            id="cold-threshold-days"
            type="number"
            min={1}
            step={1}
            value={coldDays}
            disabled={pending}
            onChange={(e) => setColdDays(e.target.value)}
            className={SELECT}
          />
          {!coldDaysValid && (
            <p className="text-xs text-blush">
              Enter a whole number of days, at least 1.
            </p>
          )}
          <p className="text-xs text-(--adm-text-muted)">
            A lead untouched this long shows as Cold on the board and in
            lists — a spotting aid only; leads never move on their own.
          </p>
        </div>
      </div>
      <footer className="px-6 py-3 border-t border-(--adm-border) bg-(--adm-surface-2) flex items-center justify-end">
        <button
          type="button"
          disabled={pending || !dirty || !coldDaysValid}
          onClick={save}
          className="font-heading text-xs uppercase tracking-[0.14em] px-4 py-2 bg-forest text-white hover:bg-forest-deep disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </footer>
    </section>
  );
}
