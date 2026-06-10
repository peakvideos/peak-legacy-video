"use client";

import Link from "next/link";
import { toast } from "sonner";
import {
  undoLeadStageMove,
  type StageMoveResult,
} from "@/app/admin/actions";

/**
 * Surfaces what a stage move did — how many pending emails it cancelled
 * and how many it scheduled — so moves never have silent side effects.
 * The scheduled count links into the email queue, and Undo restores the
 * previous stage, the cancelled jobs (original send times), and removes
 * the jobs the move scheduled.
 */
export function showStageMoveToast({
  leadId,
  stageName,
  move,
}: {
  leadId: string;
  stageName: string;
  move: StageMoveResult;
}) {
  toast(`Moved to ${stageName}`, {
    description: (
      <>
        {move.cancelled} pending email{move.cancelled === 1 ? "" : "s"}{" "}
        cancelled,{" "}
        <Link
          href="/admin/sequences"
          className="underline underline-offset-2 hover:text-gold"
        >
          {move.scheduled} scheduled
        </Link>
      </>
    ),
    action: {
      label: "Undo",
      onClick: () => {
        void undoLeadStageMove(leadId, move)
          .then(() => toast.success("Move undone"))
          .catch((err) =>
            toast.error(
              err instanceof Error ? err.message : "Couldn't undo the move.",
            ),
          );
      },
    },
  });
}
