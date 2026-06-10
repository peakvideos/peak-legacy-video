"use server";

import { revalidatePath } from "next/cache";
import { eq, gte, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { stages } from "@/lib/db/schema";

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
