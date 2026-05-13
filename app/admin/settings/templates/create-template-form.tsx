"use client";

import { useState, useTransition } from "react";
import { createTemplate } from "./actions";

export function CreateTemplateForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-heading text-xs uppercase tracking-[0.14em] px-3 py-2 bg-forest text-white hover:bg-forest-deep"
      >
        + New template
      </button>
    );
  }

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          try {
            await createTemplate(formData);
            // redirect happens server-side
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Failed to create.",
            );
          }
        });
      }}
      className="flex items-center gap-2 flex-wrap"
    >
      <input
        autoFocus
        name="name"
        type="text"
        required
        placeholder="Template name"
        disabled={pending}
        className="text-sm px-3 py-2 border border-forest/20 focus:outline-none focus:border-gold w-48"
      />
      <input
        name="subject"
        type="text"
        required
        placeholder="Subject line"
        disabled={pending}
        className="text-sm px-3 py-2 border border-forest/20 focus:outline-none focus:border-gold w-64"
      />
      <button
        type="submit"
        disabled={pending}
        className="font-heading text-xs uppercase tracking-[0.14em] px-3 py-2 bg-forest text-white hover:bg-forest-deep disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        className="text-xs text-tofino hover:text-forest px-2"
      >
        Cancel
      </button>
      {error && <p className="text-xs text-blush w-full">{error}</p>}
    </form>
  );
}
