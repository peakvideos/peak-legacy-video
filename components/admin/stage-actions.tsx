"use client";

import { useTransition } from "react";
import { setLeadStage } from "@/app/admin/actions";
import type { LeadStage } from "@/lib/admin/stages";
import {
  STAGE_BUTTON_STYLE,
  STAGE_LABELS,
  STAGE_ORDER,
} from "@/lib/admin/stages";
import { cn } from "@/lib/utils";

export { STAGE_LABELS };

export function StageActions({
  leadId,
  current,
}: {
  leadId: string;
  current: LeadStage;
}) {
  const [pending, startTransition] = useTransition();

  const handleSet = (stage: LeadStage) => {
    if (stage === current || pending) return;
    startTransition(async () => {
      await setLeadStage(leadId, stage);
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {STAGE_ORDER.map((stage) => {
        const isActive = stage === current;
        const style = STAGE_BUTTON_STYLE[stage];
        return (
          <button
            key={stage}
            type="button"
            disabled={pending || isActive}
            onClick={() => handleSet(stage)}
            className={cn(
              "font-heading text-[0.7rem] tracking-[0.08em] uppercase px-3 py-1.5 transition cursor-pointer disabled:cursor-default",
              isActive ? style.active : style.idle,
              pending && "opacity-60",
            )}
          >
            {STAGE_LABELS[stage]}
          </button>
        );
      })}
    </div>
  );
}
