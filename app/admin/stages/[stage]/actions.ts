"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { stageAutomations, stages } from "@/lib/db/schema";
import { reconcileAutomationsForStage } from "@/lib/email/sequence";

/** Resolves the stage id or throws — actions never write to a ghost stage. */
async function ensureStage(stageId: string): Promise<string> {
  const [row] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(eq(stages.id, stageId))
    .limit(1);
  if (!row) {
    throw new Error(`Unknown stage: ${stageId}`);
  }
  return row.id;
}

export async function addAutomation(args: {
  stage: string;
  templateId: string;
  delayMinutes: number;
}) {
  await requireSession();
  const stageId = await ensureStage(args.stage);

  if (args.delayMinutes < 0 || !Number.isFinite(args.delayMinutes)) {
    throw new Error("Delay must be a non-negative number.");
  }

  const existing = await db
    .select({ position: stageAutomations.position })
    .from(stageAutomations)
    .where(eq(stageAutomations.stageId, stageId));
  const nextPosition =
    existing.reduce((max, row) => Math.max(max, row.position), -1) + 1;

  await db.insert(stageAutomations).values({
    stageId,
    templateId: args.templateId,
    delayMinutes: Math.round(args.delayMinutes),
    position: nextPosition,
  });

  revalidatePath(`/admin/stages/${stageId}`);
  revalidatePath("/admin/journey");
  revalidatePath("/admin");
}

export async function updateAutomation(args: {
  id: string;
  stage: string;
  delayMinutes: number;
}) {
  await requireSession();
  const stageId = await ensureStage(args.stage);

  if (args.delayMinutes < 0 || !Number.isFinite(args.delayMinutes)) {
    throw new Error("Delay must be a non-negative number.");
  }

  await db
    .update(stageAutomations)
    .set({
      delayMinutes: Math.round(args.delayMinutes),
      updatedAt: new Date(),
    })
    .where(eq(stageAutomations.id, args.id));

  revalidatePath(`/admin/stages/${stageId}`);
  revalidatePath("/admin/journey");
  revalidatePath("/admin");
}

export async function removeAutomation(args: { id: string; stage: string }) {
  await requireSession();
  const stageId = await ensureStage(args.stage);

  await db.transaction(async (tx) => {
    await tx
      .delete(stageAutomations)
      .where(
        and(
          eq(stageAutomations.id, args.id),
          eq(stageAutomations.stageId, stageId),
        ),
      );

    await reconcileAutomationsForStage(stageId, { tx });
  });

  revalidatePath(`/admin/stages/${stageId}`);
  revalidatePath("/admin/journey");
  revalidatePath("/admin");
}

export async function reorderAutomations(args: {
  stage: string;
  orderedIds: string[];
}) {
  await requireSession();
  const stageId = await ensureStage(args.stage);

  await db.transaction(async (tx) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await tx
        .update(stageAutomations)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(stageAutomations.id, args.orderedIds[i]));
    }
  });

  revalidatePath(`/admin/stages/${stageId}`);
  revalidatePath("/admin/journey");
}
