"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setSendingPaused } from "@/app/admin/actions";
import { Switch } from "@/components/ui/switch";

/**
 * The Outbox's emergency brake. Flipping it on holds every scheduled send
 * in place — nothing is attempted, nothing is cancelled — until it is
 * flipped back, when held emails (including overdue ones) go out on the
 * worker's next run.
 */
export function OutboxPauseSwitch({ paused }: { paused: boolean }) {
  const [checked, setChecked] = useState(paused);
  const [pending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    setChecked(next);
    startTransition(async () => {
      try {
        await setSendingPaused(next);
        toast.success(
          next
            ? "Sending paused — nothing goes out until you resume."
            : "Sending resumed — held emails go out on the next run.",
        );
      } catch (err) {
        setChecked(!next);
        toast.error(
          err instanceof Error ? err.message : "Couldn't flip the pause switch.",
        );
      }
    });
  };

  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <span
        className={`font-heading text-[0.7rem] uppercase tracking-wider ${
          checked ? "text-blush" : "text-(--adm-text-muted)"
        }`}
      >
        {checked ? "Sending paused" : "Pause sending"}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={toggle}
        disabled={pending}
        className="data-[state=checked]:bg-blush"
      />
    </label>
  );
}
