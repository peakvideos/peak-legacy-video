"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailTemplates, stageAutomations } from "@/lib/db/schema";
import { sendStoredTemplateEmail } from "@/lib/email";
import { uniqueTemplateSlug } from "@/lib/admin/template-slug";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function createTemplate(formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  if (!name) throw new Error("Name is required.");
  if (!subject) throw new Error("Subject is required.");

  const slug = await uniqueTemplateSlug(name);

  const [inserted] = await db
    .insert(emailTemplates)
    .values({
      slug,
      name,
      subject,
      body: { type: "doc", content: [{ type: "paragraph" }] },
    })
    .returning({ id: emailTemplates.id });

  revalidatePath("/admin/settings/templates");
  redirect(`/admin/settings/templates/${inserted.id}`);
}

export async function updateTemplate(args: {
  id: string;
  name: string;
  subject: string;
  slug: string;
  body: unknown;
}) {
  await requireSession();
  const name = args.name.trim();
  const subject = args.subject.trim();
  const slug = args.slug.trim();
  if (!name) throw new Error("Name is required.");
  if (!subject) throw new Error("Subject is required.");
  if (!SLUG_RE.test(slug)) {
    throw new Error("Slug must be lowercase letters, digits, and hyphens.");
  }

  await db
    .update(emailTemplates)
    .set({
      name,
      subject,
      slug,
      body: args.body,
      updatedAt: new Date(),
    })
    .where(eq(emailTemplates.id, args.id));

  revalidatePath("/admin/settings/templates");
  revalidatePath(`/admin/settings/templates/${args.id}`);
  revalidatePath("/admin");
}

export async function archiveTemplate(id: string) {
  await requireSession();
  await db
    .update(emailTemplates)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(emailTemplates.id, id));

  // Detach from any stage automations so it can't be re-queued.
  await db
    .delete(stageAutomations)
    .where(eq(stageAutomations.templateId, id));

  revalidatePath("/admin/settings/templates");
  revalidatePath("/admin");
}

export async function unarchiveTemplate(id: string) {
  await requireSession();
  await db
    .update(emailTemplates)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(emailTemplates.id, id));
  revalidatePath("/admin/settings/templates");
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
