"use server";

import { revalidatePath } from "next/cache";
import { eq, gt, gte, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { leads, stages } from "@/lib/db/schema";
import {
  cancelPendingForLead,
  transitionLeadStageAutomations,
} from "@/lib/email/sequence";
import { getSettings, updateSettings } from "@/lib/stages/settings";

/**
 * Adds a stage to the pipeline at the given board position, shifting the
 * stages after it one slot right. Owner-created stages start flagless and
 * without a seeded empty-column hint.
 */
export async function createStage(args: {
  name: string;
  color: string;
  position: number;
}) {
  await requireSession();

  const name = args.name.trim();
  if (!name) {
    throw new Error("Stage name is required");
  }

  await db.transaction(async (tx) => {
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(stages);
    const position = Math.min(Math.max(args.position, 0), count);

    await tx
      .update(stages)
      .set({ position: sql`${stages.position} + 1` })
      .where(gte(stages.position, position));
    await tx.insert(stages).values({ name, color: args.color, position });
  });

  revalidatePath("/admin");
}

async function updateStageOrThrow(
  stageId: string,
  patch: { name?: string; color?: string },
) {
  const updated = await db
    .update(stages)
    .set(patch)
    .where(eq(stages.id, stageId))
    .returning({ id: stages.id });
  if (updated.length === 0) {
    throw new Error("Unknown stage");
  }
  revalidatePath("/admin");
}

/**
 * Renames a stage. Everything references stages by id (ADR 0001), so this
 * changes nothing but the label.
 */
export async function renameStage(stageId: string, name: string) {
  await requireSession();

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Stage name is required");
  }
  await updateStageOrThrow(stageId, { name: trimmed });
}

/**
 * Rewrites the pipeline order to the given id sequence — must be a
 * permutation of every stage. Everything that orders stages (the board,
 * forward-only booking promotion, the view split) reads positions, so the
 * new order applies everywhere at once.
 */
export async function reorderStages(orderedIds: string[]) {
  await requireSession();

  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: stages.id }).from(stages);
    const known = new Set(existing.map((s) => s.id));
    const isPermutation =
      orderedIds.length === known.size &&
      new Set(orderedIds).size === known.size &&
      orderedIds.every((id) => known.has(id));
    if (!isPermutation) {
      throw new Error("Reorder must include every stage exactly once");
    }

    for (const [position, id] of orderedIds.entries()) {
      await tx.update(stages).set({ position }).where(eq(stages.id, id));
    }
  });

  revalidatePath("/admin");
}

/** Recolors a stage — the palette key the board and badges resolve. */
export async function recolorStage(stageId: string, color: string) {
  await requireSession();
  await updateStageOrThrow(stageId, { color });
}

/**
 * Deletes a stage from the pipeline, closing the position gap it leaves.
 * A stage holding leads needs a destination stage; every resident lead is
 * relocated there before the stage goes. Relocation cancels the leads'
 * unsent jobs but enqueues the destination's automations only behind the
 * explicit opt-in — a bulk administrative move is not an ordinary lead
 * move. If the Entry or Booking Stage pointer names this stage, the
 * matching re-point argument is required and applied in the same
 * transaction, so a delete can never leave a setting dangling.
 */
export async function deleteStage(args: {
  stageId: string;
  destinationStageId?: string;
  enqueueDestinationAutomations?: boolean;
  entryStageId?: string;
  bookingStageId?: string;
}) {
  await requireSession();

  await db.transaction(async (tx) => {
    const [stage] = await tx
      .select({ id: stages.id, position: stages.position })
      .from(stages)
      .where(eq(stages.id, args.stageId))
      .limit(1);
    if (!stage) {
      throw new Error("Unknown stage");
    }

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(stages);
    if (count <= 1) {
      throw new Error("The pipeline must keep at least one stage.");
    }

    const current = await getSettings({ tx });
    const repoint: Parameters<typeof updateSettings>[0] = {};
    if (current.entryStageId === stage.id) {
      if (!args.entryStageId || args.entryStageId === stage.id) {
        throw new Error(
          "The Entry Stage points here — re-point it to another stage first.",
        );
      }
      repoint.entryStageId = args.entryStageId;
    }
    if (current.bookingStageId === stage.id) {
      if (!args.bookingStageId || args.bookingStageId === stage.id) {
        throw new Error(
          "The Booking Stage points here — re-point it to another stage first.",
        );
      }
      repoint.bookingStageId = args.bookingStageId;
    }
    if (Object.keys(repoint).length > 0) {
      await updateSettings(repoint, { tx });
    }

    const residents = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.stageId, stage.id));
    if (residents.length > 0) {
      const destinationId = args.destinationStageId;
      if (!destinationId || destinationId === stage.id) {
        throw new Error(
          "This stage holds leads — choose a destination stage for them.",
        );
      }
      const [destination] = await tx
        .select({ id: stages.id })
        .from(stages)
        .where(eq(stages.id, destinationId))
        .limit(1);
      if (!destination) {
        throw new Error("Unknown destination stage");
      }

      await tx
        .update(leads)
        .set({ stageId: destination.id, updatedAt: new Date() })
        .where(eq(leads.stageId, stage.id));

      // Leaving a stage cancels unsent jobs either way; only the opt-in
      // treats the relocation as a stage entry that enqueues the
      // destination's automations.
      for (const resident of residents) {
        if (args.enqueueDestinationAutomations) {
          await transitionLeadStageAutomations(resident.id, destination.id, {
            tx,
          });
        } else {
          await cancelPendingForLead(resident.id, { tx });
        }
      }
    }

    await tx.delete(stages).where(eq(stages.id, stage.id));
    await tx
      .update(stages)
      .set({ position: sql`${stages.position} - 1` })
      .where(gt(stages.position, stage.position));
  });

  revalidatePath("/admin");
}
