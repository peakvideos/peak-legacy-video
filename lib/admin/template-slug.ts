import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/db/schema";

export function slugifyTemplateName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The slug for a new template: derived from the name, suffixed until free. */
export async function uniqueTemplateSlug(name: string): Promise<string> {
  const baseSlug = slugifyTemplateName(name) || `template-${Date.now()}`;
  let slug = baseSlug;
  let attempt = 1;
  while (true) {
    const [existing] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(eq(emailTemplates.slug, slug))
      .limit(1);
    if (!existing) return slug;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
}
