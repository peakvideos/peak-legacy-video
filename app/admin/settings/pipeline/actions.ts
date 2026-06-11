"use server";

import { revalidatePath } from "next/cache";
import { inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { stages } from "@/lib/db/schema";
import { updateSettings } from "@/lib/stages/settings";

/**
 * Updates the pipeline's settings: the Entry Stage (where new inquiries
 * land and whose automations they enqueue), the Booking Stage (the
 * forward-only promotion target when a lead books a call), and the cold
 * threshold (days untouched before a lead reads as Cold — an indicator
 * only, never a stage move). Omitted fields are untouched.
 */
export async function updatePipelineSettings(patch: {
  entryStageId?: string;
  bookingStageId?: string;
  coldThresholdDays?: number;
}) {
  await requireSession();

  if (
    patch.coldThresholdDays !== undefined &&
    (!Number.isInteger(patch.coldThresholdDays) || patch.coldThresholdDays < 1)
  ) {
    throw new Error("The cold threshold must be a whole number of days, at least 1.");
  }

  const targetIds = [patch.entryStageId, patch.bookingStageId].filter(
    (id): id is string => id !== undefined,
  );
  if (targetIds.length > 0) {
    const known = await db
      .select({ id: stages.id })
      .from(stages)
      .where(inArray(stages.id, targetIds));
    const knownIds = new Set(known.map((s) => s.id));
    if (targetIds.some((id) => !knownIds.has(id))) {
      throw new Error("Unknown stage");
    }
  }

  await updateSettings({
    ...(patch.entryStageId !== undefined && {
      entryStageId: patch.entryStageId,
    }),
    ...(patch.bookingStageId !== undefined && {
      bookingStageId: patch.bookingStageId,
    }),
    ...(patch.coldThresholdDays !== undefined && {
      coldThresholdDays: patch.coldThresholdDays,
    }),
  });

  revalidatePath("/admin");
}
