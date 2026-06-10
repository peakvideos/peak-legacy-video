"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setLeadStage } from "@/app/admin/actions";
import { showStageMoveToast } from "./move-toast";
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
    const target = stages.find((s) => s.id === stageId);
    if (!target) return;
    startTransition(async () => {
      try {
        const move = await setLeadStage(leadId, stageId);
        showStageMoveToast({ leadId, stageName: target.name, move });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't move the lead.",
        );
      }
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
