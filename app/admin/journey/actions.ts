"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailTemplates, stageAutomations, stages } from "@/lib/db/schema";
import { uniqueTemplateSlug } from "@/lib/admin/template-slug";

/**
 * One paragraph per written line; blank lines become empty paragraphs so
 * the spacing the owner typed survives into the Tiptap document.
 */
function bodyDocFromText(text: string) {
  return {
    type: "doc",
    content: text
      .trim()
      .split(/\r?\n/)
      .map((line) =>
        line.trim() === ""
          ? { type: "paragraph" }
          : { type: "paragraph", content: [{ type: "text", text: line }] },
      ),
  };
}

/**
 * The Journey's "write a new one in place": creates the template and
 * attaches it to the stage as one flow, so a failed attach never leaves
 * an orphaned template behind.
 */
export async function createTemplateAndAttach(args: {
  stage: string;
  name: string;
  subject: string;
  /** Plain text; lines become paragraphs. */
  body: string;
  delayMinutes: number;
}): Promise<{ templateId: string }> {
  await requireSession();

  const name = args.name.trim();
  const subject = args.subject.trim();
  const body = args.body.trim();
  if (!name) throw new Error("Name is required.");
  if (!subject) throw new Error("Subject is required.");
  if (!body) throw new Error("Body is required.");
  if (args.delayMinutes < 0 || !Number.isFinite(args.delayMinutes)) {
    throw new Error("Delay must be a non-negative number.");
  }

  const [stage] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(eq(stages.id, args.stage))
    .limit(1);
  if (!stage) {
    throw new Error(`Unknown stage: ${args.stage}`);
  }

  const slug = await uniqueTemplateSlug(name);

  const templateId = await db.transaction(async (tx) => {
    const [template] = await tx
      .insert(emailTemplates)
      .values({ slug, name, subject, body: bodyDocFromText(body) })
      .returning({ id: emailTemplates.id });

    const existing = await tx
      .select({ position: stageAutomations.position })
      .from(stageAutomations)
      .where(eq(stageAutomations.stageId, stage.id));
    const nextPosition =
      existing.reduce((max, row) => Math.max(max, row.position), -1) + 1;

    await tx.insert(stageAutomations).values({
      stageId: stage.id,
      templateId: template.id,
      delayMinutes: Math.round(args.delayMinutes),
      position: nextPosition,
    });

    return template.id;
  });

  revalidatePath("/admin/journey");
  revalidatePath(`/admin/stages/${stage.id}`);
  revalidatePath("/admin/settings/templates");
  revalidatePath("/admin");

  return { templateId };
}
