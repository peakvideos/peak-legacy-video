"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailTemplates, stageAutomations, stages } from "@/lib/db/schema";
import { sendStoredTemplateEmail } from "@/lib/email";
import { uniqueTemplateSlug } from "@/lib/admin/template-slug";
import {
  cancelPendingForTemplate,
  reconcileAutomationsForStage,
} from "@/lib/email/sequence";

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

function ensureValidDelay(delayMinutes: number): void {
  if (delayMinutes < 0 || !Number.isFinite(delayMinutes)) {
    throw new Error("Delay must be a non-negative number.");
  }
}

/** New automations join the end of the stage's drag-set order. */
async function nextPositionForStage(
  runner: Pick<typeof db, "select">,
  stageId: string,
): Promise<number> {
  const existing = await runner
    .select({ position: stageAutomations.position })
    .from(stageAutomations)
    .where(eq(stageAutomations.stageId, stageId));
  return existing.reduce((max, row) => Math.max(max, row.position), -1) + 1;
}

export async function addAutomation(args: {
  stage: string;
  templateId: string;
  delayMinutes: number;
}) {
  await requireSession();
  const stageId = await ensureStage(args.stage);
  ensureValidDelay(args.delayMinutes);

  await db.insert(stageAutomations).values({
    stageId,
    templateId: args.templateId,
    delayMinutes: Math.round(args.delayMinutes),
    position: await nextPositionForStage(db, stageId),
  });

  revalidatePath("/admin/journey");
  revalidatePath("/admin");
}

export async function updateAutomation(args: {
  id: string;
  stage: string;
  delayMinutes: number;
}) {
  await requireSession();
  await ensureStage(args.stage);
  ensureValidDelay(args.delayMinutes);

  await db
    .update(stageAutomations)
    .set({
      delayMinutes: Math.round(args.delayMinutes),
      updatedAt: new Date(),
    })
    .where(eq(stageAutomations.id, args.id));

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

  revalidatePath("/admin/journey");
  revalidatePath("/admin");
}

export async function reorderAutomations(args: {
  stage: string;
  orderedIds: string[];
}) {
  await requireSession();
  await ensureStage(args.stage);

  await db.transaction(async (tx) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await tx
        .update(stageAutomations)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(stageAutomations.id, args.orderedIds[i]));
    }
  });

  revalidatePath("/admin/journey");
}

/**
 * Loads the template the slide-over editor opens on. Fetched on open rather
 * than shipped with the journey payload so the editor always starts from
 * what's stored, not from a stale page render.
 */
export async function getTemplateForEditor(id: string): Promise<{
  id: string;
  name: string;
  subject: string;
  body: unknown;
}> {
  await requireSession();

  const [template] = await db
    .select({
      id: emailTemplates.id,
      name: emailTemplates.name,
      subject: emailTemplates.subject,
      body: emailTemplates.body,
    })
    .from(emailTemplates)
    .where(eq(emailTemplates.id, id))
    .limit(1);
  if (!template) throw new Error("Template not found.");
  return template;
}

/**
 * The slide-over editor's save: templates are edited where they are used,
 * so only the content a recipient sees — subject and rich-text body — is
 * editable. Pending jobs render at send time and pick the edit up for free.
 */
export async function updateTemplateContent(args: {
  id: string;
  subject: string;
  /** Tiptap JSON document. */
  body: unknown;
}) {
  await requireSession();

  const subject = args.subject.trim();
  if (!subject) throw new Error("Subject is required.");

  await db
    .update(emailTemplates)
    .set({ subject, body: args.body, updatedAt: new Date() })
    .where(eq(emailTemplates.id, args.id));

  revalidatePath("/admin/journey");
  revalidatePath("/admin");
}

/**
 * Retires a template from the journey: it leaves every picker and the
 * Unattached shelf, its automations are detached, and any in-flight pending
 * sends of it are cancelled — all atomically, so no lead can receive an
 * email the owner just archived.
 */
export async function archiveTemplate(id: string) {
  await requireSession();

  await db.transaction(async (tx) => {
    await tx
      .update(emailTemplates)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(emailTemplates.id, id));

    await tx
      .delete(stageAutomations)
      .where(eq(stageAutomations.templateId, id));

    await cancelPendingForTemplate(id, { tx });
  });

  revalidatePath("/admin/journey");
  revalidatePath("/admin/outbox");
  revalidatePath("/admin");
}

/**
 * Renders a template with sample lead data and sends it to the signed-in
 * admin's email so they can preview the actual delivered output.
 *
 * Does not record an `email_jobs` row — this is a manual one-off and isn't
 * part of any lead's sequence history.
 */
export async function sendTestTemplateEmail(templateId: string): Promise<{
  ok: boolean;
  to?: string;
  error?: string;
}> {
  const session = await requireSession();
  const recipient = session.user.email;
  if (!recipient) {
    return { ok: false, error: "No email on session." };
  }

  const [template] = await db
    .select({
      subject: emailTemplates.subject,
      body: emailTemplates.body,
      archivedAt: emailTemplates.archivedAt,
    })
    .from(emailTemplates)
    .where(eq(emailTemplates.id, templateId))
    .limit(1);
  if (!template) {
    return { ok: false, error: "Template not found." };
  }
  if (template.archivedAt) {
    return { ok: false, error: "Template is archived." };
  }

  const result = await sendStoredTemplateEmail({
    template: { subject: template.subject, body: template.body },
    to: recipient,
    lead: {
      firstName: session.user.name?.split(" ")[0] || "Test",
      lastName: session.user.name?.split(" ").slice(1).join(" ") || "User",
      email: recipient,
      packageInterest: "legacy",
      bookingUrl:
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    },
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, to: recipient };
}

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
  ensureValidDelay(args.delayMinutes);

  const stageId = await ensureStage(args.stage);

  const slug = await uniqueTemplateSlug(name);

  const templateId = await db.transaction(async (tx) => {
    const [template] = await tx
      .insert(emailTemplates)
      .values({ slug, name, subject, body: bodyDocFromText(body) })
      .returning({ id: emailTemplates.id });

    await tx.insert(stageAutomations).values({
      stageId,
      templateId: template.id,
      delayMinutes: Math.round(args.delayMinutes),
      position: await nextPositionForStage(tx, stageId),
    });

    return template.id;
  });

  revalidatePath("/admin/journey");
  revalidatePath("/admin");

  return { templateId };
}
