"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setLeadUnsubscribed } from "@/app/admin/actions";
import { ConfirmDialog } from "./confirm-dialog";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function UnsubscribeToggle({
  leadId,
  unsubscribedAt,
}: {
  leadId: string;
  unsubscribedAt: Date | null;
}) {
  const [pending, startTransition] = useTransition();

  const resubscribe = () => {
    startTransition(async () => {
      await setLeadUnsubscribed(leadId, false);
      toast.success("Lead resubscribed");
    });
  };

  if (unsubscribedAt) {
    return (
      <div className="flex items-center gap-3 bg-blush/10 border border-blush/40 px-3 py-2 text-sm flex-wrap">
        <span className="font-heading text-blush text-xs uppercase tracking-[0.14em]">
          Unsubscribed
        </span>
        <span className="text-(--adm-text-muted) text-xs">
          on {dateFmt.format(unsubscribedAt)} — drip emails are paused.
        </span>
        <button
          type="button"
          onClick={resubscribe}
          disabled={pending}
          className="ml-auto text-xs font-heading uppercase tracking-wider text-(--adm-text) hover:text-gold disabled:opacity-50"
        >
          {pending ? "…" : "Resubscribe"}
        </button>
      </div>
    );
  }

  return (
    <ConfirmDialog
      title="Mark this lead as unsubscribed?"
      description="They won't receive any more drip emails. You can resubscribe them later from this page."
      confirmLabel="Unsubscribe"
      destructive
      onConfirm={async () => {
        await setLeadUnsubscribed(leadId, true);
        toast.success("Lead unsubscribed");
      }}
      trigger={
        <button
          type="button"
          className="text-[0.7rem] font-heading uppercase tracking-wider text-(--adm-text-muted) hover:text-blush"
        >
          Unsubscribe lead
        </button>
      }
    />
  );
}
