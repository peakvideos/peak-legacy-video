"use client";

import { useCallback, useState } from "react";
import { setLeadCrmNotes } from "@/app/admin/actions";
import { useAutosave, type AutosaveStatus } from "@/lib/use-autosave";

export function CrmNotesEditor({
  leadId,
  initialValue,
}: {
  leadId: string;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);

  const save = useCallback(
    async (next: string) => {
      await setLeadCrmNotes(leadId, next);
    },
    [leadId],
  );

  const { status, savedAt, error, flushNow, dirty } = useAutosave({
    value,
    initialValue,
    save,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-heading text-[0.7rem] uppercase tracking-[0.12em] text-(--adm-text-muted)">
          Internal notes
        </p>
        <StatusIndicator
          status={status}
          dirty={dirty}
          savedAt={savedAt}
          error={error}
          onRetry={() => void flushNow()}
        />
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (dirty) void flushNow();
        }}
        rows={4}
        placeholder="Anything you want to remember about this lead — call notes, follow-up plans, why they went to Lost, etc."
        className="w-full px-3 py-2 bg-(--adm-surface) border border-(--adm-border) text-sm text-(--adm-text) placeholder:text-(--adm-text-muted) focus:outline-none focus:border-gold resize-vertical"
      />
    </div>
  );
}

const timeFmt = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
});

function StatusIndicator({
  status,
  dirty,
  savedAt,
  error,
  onRetry,
}: {
  status: AutosaveStatus;
  dirty: boolean;
  savedAt: Date | null;
  error: string | null;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <span className="flex items-center gap-2 text-[0.7rem]">
        <span className="text-blush" title={error ?? undefined}>
          Save failed
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="font-heading uppercase tracking-[0.1em] text-gold hover:text-(--adm-text) cursor-pointer"
        >
          Retry
        </button>
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[0.7rem] text-(--adm-text-muted)">
        <Spinner /> Saving…
      </span>
    );
  }
  if (status === "editing" || dirty) {
    return (
      <span className="text-[0.7rem] text-(--adm-text-muted) opacity-70">Editing…</span>
    );
  }
  if (status === "saved" && savedAt) {
    return (
      <span className="flex items-center gap-1 text-[0.7rem] text-(--adm-text-muted)">
        <CheckIcon /> Saved {timeFmt.format(savedAt)}
      </span>
    );
  }
  return <span className="text-[0.7rem] text-(--adm-text-muted) opacity-60">Saved</span>;
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 border-[1.5px] border-(--adm-text-muted)/30 border-t-(--adm-text-muted) rounded-full animate-spin"
    />
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M2.5 6.2 5 8.6 9.7 3.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
