"use client";

import { useTransition } from "react";
import { setLeadStage } from "@/app/admin/actions";
import { stagePalette, type StageRow } from "@/lib/admin/stages";
import { cn } from "@/lib/utils";

export function StageActions({
  leadId,
  currentStageId,
  stages,
}: {
  leadId: string;
  currentStageId: string;
  stages: StageRow[];
}) {
  const [pending, startTransition] = useTransition();

  const handleSet = (stageId: string) => {
    if (stageId === currentStageId || pending) return;
    startTransition(async () => {
      await setLeadStage(leadId, stageId);
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((stage) => {
        const isActive = stage.id === currentStageId;
        const style = stagePalette(stage.color).button;
        return (
          <button
            key={stage.id}
            type="button"
            disabled={pending || isActive}
            onClick={() => handleSet(stage.id)}
            className={cn(
              "font-heading text-[0.7rem] tracking-[0.08em] uppercase px-3 py-1.5 transition cursor-pointer disabled:cursor-default",
              isActive ? style.active : style.idle,
              pending && "opacity-60",
            )}
          >
            {stage.name}
          </button>
        );
      })}
    </div>
  );
}
