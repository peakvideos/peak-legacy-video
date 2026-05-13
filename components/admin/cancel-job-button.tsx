"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cancelEmailJob } from "@/app/admin/actions";

export function CancelJobButton({
  jobId,
  templateName,
}: {
  jobId: string;
  templateName: string;
}) {
  const [pending, startTransition] = useTransition();

  const handle = () => {
    startTransition(async () => {
      try {
        await cancelEmailJob(jobId);
        toast.success(`Cancelled "${templateName}"`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to cancel.");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className="text-[0.7rem] font-heading uppercase tracking-wider text-(--adm-text-muted) hover:text-blush disabled:opacity-50"
    >
      {pending ? "…" : "Cancel"}
    </button>
  );
}
