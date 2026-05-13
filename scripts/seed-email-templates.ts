/**
 * Seeds the 5 default nurture templates and attaches them to the `new`
 * stage as automations. Idempotent: skips templates whose slug already
 * exists, and skips automations whose (stage, template) pair is taken.
 *
 * Run: `pnpm db:seed:templates`
 */

import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { emailTemplates, stageAutomations } from "../lib/db/schema";

type Doc = {
  type: "doc";
  content: Array<{
    type: string;
    content?: Array<{
      type: "text";
      text: string;
      marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
    }>;
  }>;
};

function p(text: string): Doc["content"][number] {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function pWithLink(prefix: string, hrefVar: string): Doc["content"][number] {
  return {
    type: "paragraph",
    content: [
      { type: "text", text: prefix },
      {
        type: "text",
        text: `{{${hrefVar}}}`,
        marks: [{ type: "link", attrs: { href: `{{${hrefVar}}}` } }],
      },
    ],
  };
}

function doc(...nodes: Doc["content"]): Doc {
  return { type: "doc", content: nodes };
}

const SIGNATURE = p("— The Peak Studios CO Team");

const TEMPLATES: Array<{
  slug: string;
  name: string;
  subject: string;
  body: Doc;
  delayMinutes: number;
  position: number;
}> = [
  {
    slug: "nurture-thanks",
    name: "Nurture · Thanks for reaching out",
    subject: "Thanks for reaching out — we'll be in touch soon!",
    body: doc(
      p("Hi {{firstName}},"),
      p(
        "Thanks so much for getting in touch with Peak Studios CO! We're excited to connect with you.",
      ),
      p(
        "One of our team will reach out within 1 business day to answer any questions and help you find a time that works.",
      ),
      SIGNATURE,
    ),
    delayMinutes: 5,
    position: 0,
  },
  {
    slug: "nurture-followup",
    name: "Nurture · Ready to find a time?",
    subject: "Ready to find a time?",
    body: doc(
      p("Hi {{firstName}},"),
      p(
        "Just following up on your inquiry — we'd love to book a quick call to walk you through the process and answer any questions you have.",
      ),
      pWithLink(
        "Feel free to reply with a time that suits you, or grab a spot directly here: ",
        "bookingUrl",
      ),
      SIGNATURE,
    ),
    delayMinutes: 60 * 24, // 1 day
    position: 1,
  },
  {
    slug: "nurture-reminder",
    name: "Nurture · Gentle reminder",
    subject: "Still happy to help — Peak Studios CO",
    body: doc(
      p("Hi {{firstName}},"),
      p(
        "Just a friendly nudge in case life got busy! We'd still love to connect and chat about your legacy film session.",
      ),
      pWithLink("Reply anytime or book a call here: ", "bookingUrl"),
      SIGNATURE,
    ),
    delayMinutes: 60 * 24 * 3, // 3 days
    position: 2,
  },
  {
    slug: "nurture-checkin",
    name: "Nurture · Check-in",
    subject: "Quick check-in from Peak Studios CO",
    body: doc(
      p("Hi {{firstName}},"),
      p(
        "No pressure at all — just wanted to check in one more time in case you had any questions holding you back.",
      ),
      pWithLink(
        "We're happy to answer anything. Just hit reply or grab a time here: ",
        "bookingUrl",
      ),
      SIGNATURE,
    ),
    delayMinutes: 60 * 24 * 6, // 6 days
    position: 3,
  },
  {
    slug: "nurture-final",
    name: "Nurture · Final note",
    subject: "We're here whenever you're ready",
    body: doc(
      p("Hi {{firstName}},"),
      p(
        "This will be our last nudge — we promise! Whenever the timing feels right, we're here and happy to help.",
      ),
      pWithLink("Just reply to this email or visit ", "bookingUrl"),
      p("Wishing you and your family all the best,"),
      SIGNATURE,
    ),
    delayMinutes: 60 * 24 * 14, // 14 days
    position: 4,
  },
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[seed:templates] Running in production — only inserting missing templates/automations.",
    );
  }

  let templatesCreated = 0;
  let automationsCreated = 0;

  for (const tpl of TEMPLATES) {
    const [existing] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(eq(emailTemplates.slug, tpl.slug))
      .limit(1);

    let templateId = existing?.id;

    if (!templateId) {
      const [inserted] = await db
        .insert(emailTemplates)
        .values({
          slug: tpl.slug,
          name: tpl.name,
          subject: tpl.subject,
          body: tpl.body,
        })
        .returning({ id: emailTemplates.id });
      templateId = inserted.id;
      templatesCreated++;
      console.log(`  ✅ created template ${tpl.slug}`);
    } else {
      console.log(`  — template ${tpl.slug} already exists`);
    }

    const [existingAutomation] = await db
      .select({ id: stageAutomations.id })
      .from(stageAutomations)
      .where(eq(stageAutomations.templateId, templateId))
      .limit(1);

    if (!existingAutomation) {
      await db.insert(stageAutomations).values({
        stage: "new",
        templateId,
        delayMinutes: tpl.delayMinutes,
        position: tpl.position,
      });
      automationsCreated++;
      console.log(`     ✅ attached to new stage at position ${tpl.position}`);
    } else {
      console.log(`     — automation already exists for ${tpl.slug}`);
    }
  }

  console.log(
    `\nDone. Created ${templatesCreated} template(s), ${automationsCreated} automation(s).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
