"use server";

import { revalidatePath } from "next/cache";
import { inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { stages } from "@/lib/db/schema";
import { updateSettings } from "@/lib/stages/settings";

/**
 * Re-points the pipeline's settings pointers: the Entry Stage (where new
 * inquiries land and whose automations they enqueue) and the Booking Stage
 * (the forward-only promotion target when a lead books a call). Omitted
 * pointers are untouched.
 */
export async function updatePipelineSettings(patch: {
  entryStageId?: string;
  bookingStageId?: string;
}) {
  await requireSession();

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
  });

  revalidatePath("/admin");
}
