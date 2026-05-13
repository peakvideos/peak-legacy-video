"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stageAutomations } from "@/lib/db/schema";
import {
  reconcileAutomationsForStage,
  type LeadStage,
} from "@/lib/email/sequence";
import { STAGE_ORDER } from "@/lib/admin/stages";

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

function asLeadStage(stage: string): LeadStage {
  if (!(STAGE_ORDER as string[]).includes(stage)) {
    throw new Error(`Unknown stage: ${stage}`);
  }
  return stage as LeadStage;
}

export async function addAutomation(args: {
  stage: string;
  templateId: string;
  delayMinutes: number;
}) {
  await requireSession();
  const stage = asLeadStage(args.stage);

  if (args.delayMinutes < 0 || !Number.isFinite(args.delayMinutes)) {
    throw new Error("Delay must be a non-negative number.");
  }

  const existing = await db
    .select({ position: stageAutomations.position })
    .from(stageAutomations)
    .where(eq(stageAutomations.stage, stage));
  const nextPosition =
    existing.reduce((max, row) => Math.max(max, row.position), -1) + 1;

  await db.insert(stageAutomations).values({
    stage,
    templateId: args.templateId,
    delayMinutes: Math.round(args.delayMinutes),
    position: nextPosition,
  });

  revalidatePath(`/admin/stages/${stage}`);
  revalidatePath("/admin");
}

export async function updateAutomation(args: {
  id: string;
  stage: string;
  delayMinutes: number;
}) {
  await requireSession();
  const stage = asLeadStage(args.stage);

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

  revalidatePath(`/admin/stages/${stage}`);
  revalidatePath("/admin");
}

export async function removeAutomation(args: { id: string; stage: string }) {
  await requireSession();
  const stage = asLeadStage(args.stage);

  await db.transaction(async (tx) => {
    await tx
      .delete(stageAutomations)
      .where(
        and(
          eq(stageAutomations.id, args.id),
          eq(stageAutomations.stage, stage),
        ),
      );

    await reconcileAutomationsForStage(stage, { tx });
  });

  revalidatePath(`/admin/stages/${stage}`);
  revalidatePath("/admin");
}

export async function reorderAutomations(args: {
  stage: string;
  orderedIds: string[];
}) {
  await requireSession();
  const stage = asLeadStage(args.stage);

  await db.transaction(async (tx) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await tx
        .update(stageAutomations)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(stageAutomations.id, args.orderedIds[i]));
    }
  });

  revalidatePath(`/admin/stages/${stage}`);
}
