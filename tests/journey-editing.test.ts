import { beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailTemplates, stageAutomations } from "@/lib/db/schema";
import {
  addAutomation,
  createTemplateAndAttach,
  removeAutomation,
  reorderAutomations,
  updateAutomation,
} from "@/app/admin/journey/actions";
import { loadJourney } from "@/lib/admin/journey";
import { signInAsOwner } from "./helpers/auth";
import {
  attachAutomation,
  createEmailJob,
  createLead,
  createTemplate,
  jobsForLead,
  stageByName,
  tiptapDoc,
} from "./helpers/fixtures";

beforeEach(async () => {
  await signInAsOwner();
});

test("editing a delay persists and the journey re-sorts the stage into send order", async () => {
  const entry = await stageByName("New");
  const checkIn = await createTemplate({ name: "Check-in" });
  const welcome = await createTemplate({ name: "Welcome" });
  await attachAutomation(entry.id, checkIn.id, {
    delayMinutes: 60,
    position: 0,
  });
  const auto = await attachAutomation(entry.id, welcome.id, {
    delayMinutes: 60 * 24,
    position: 1,
  });

  // Welcome moves from a day out to immediate — it should now send first.
  await updateAutomation({ id: auto.id, stage: entry.id, delayMinutes: 0 });

  const journey = await loadJourney();
  const column = journey.stages.find((s) => s.id === entry.id)!;
  expect(column.automations.map((a) => a.templateName)).toEqual([
    "Welcome",
    "Check-in",
  ]);
  expect(column.automations[0].delayMinutes).toBe(0);
});

test("an invalid delay is rejected and the stored delay is untouched", async () => {
  const entry = await stageByName("New");
  const welcome = await createTemplate({ name: "Welcome" });
  const auto = await attachAutomation(entry.id, welcome.id, {
    delayMinutes: 60,
  });

  await expect(
    updateAutomation({ id: auto.id, stage: entry.id, delayMinutes: -5 }),
  ).rejects.toThrow(/non-negative/i);
  await expect(
    updateAutomation({ id: auto.id, stage: entry.id, delayMinutes: NaN }),
  ).rejects.toThrow(/non-negative/i);

  const journey = await loadJourney();
  const column = journey.stages.find((s) => s.id === entry.id)!;
  expect(column.automations[0].delayMinutes).toBe(60);
});

test("attaching an existing template adds it to the stage after what's already there", async () => {
  const entry = await stageByName("New");
  const welcome = await createTemplate({ name: "Welcome" });
  const followUp = await createTemplate({
    name: "Follow-up",
    subject: "Still thinking it over?",
  });
  await attachAutomation(entry.id, welcome.id, { delayMinutes: 0 });

  await addAutomation({
    stage: entry.id,
    templateId: followUp.id,
    delayMinutes: 60 * 24 * 3,
  });

  const journey = await loadJourney();
  const column = journey.stages.find((s) => s.id === entry.id)!;
  expect(column.automations).toHaveLength(2);
  expect(column.automations.at(-1)).toEqual(
    expect.objectContaining({
      templateId: followUp.id,
      templateName: "Follow-up",
      templateSubject: "Still thinking it over?",
      delayMinutes: 60 * 24 * 3,
    }),
  );
  // The shelf no longer offers it — it's attached now.
  expect(journey.unattached.map((t) => t.id)).not.toContain(followUp.id);

  // It joins the end of the editor order, after the existing automation.
  const [row] = await db
    .select({ position: stageAutomations.position })
    .from(stageAutomations)
    .where(eq(stageAutomations.templateId, followUp.id));
  expect(row.position).toBe(1);
});

test("writing a new email in place creates the template and attaches it in one flow", async () => {
  const booked = await stageByName("Booked a call");

  const { templateId } = await createTemplateAndAttach({
    stage: booked.id,
    name: "Call prep",
    subject: "Before our call, {{firstName}}",
    body: "Hi {{firstName}},\nHere's how to prepare for our call.",
    delayMinutes: 60,
  });

  const journey = await loadJourney();
  const column = journey.stages.find((s) => s.id === booked.id)!;
  expect(column.automations).toEqual([
    expect.objectContaining({
      templateId,
      templateName: "Call prep",
      templateSubject: "Before our call, {{firstName}}",
      delayMinutes: 60,
    }),
  ]);
  expect(journey.unattached.map((t) => t.id)).not.toContain(templateId);

  // The template is a full citizen — slug, and a body built from the
  // written text, one paragraph per line.
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, templateId));
  expect(template.slug).toBe("call-prep");
  expect(template.body).toEqual(
    tiptapDoc("Hi {{firstName}},", "Here's how to prepare for our call."),
  );
});

test("a half-written new email is rejected wholesale — no template, no automation", async () => {
  const entry = await stageByName("New");
  const draft = {
    stage: entry.id,
    name: "Welcome",
    subject: "Welcome to Peak",
    body: "Hi {{firstName}}!",
    delayMinutes: 0,
  };

  await expect(
    createTemplateAndAttach({ ...draft, name: "  " }),
  ).rejects.toThrow(/name/i);
  await expect(
    createTemplateAndAttach({ ...draft, subject: "" }),
  ).rejects.toThrow(/subject/i);
  await expect(
    createTemplateAndAttach({ ...draft, body: " \n " }),
  ).rejects.toThrow(/body/i);
  await expect(
    createTemplateAndAttach({ ...draft, delayMinutes: -1 }),
  ).rejects.toThrow(/non-negative/i);

  expect(await db.select().from(emailTemplates)).toHaveLength(0);
  expect(await db.select().from(stageAutomations)).toHaveLength(0);
});

test("dragging cards into a new order persists it for cards sharing a delay", async () => {
  const entry = await stageByName("New");
  const checklist = await createTemplate({ name: "Checklist" });
  const intro = await createTemplate({ name: "Intro" });
  const pricing = await createTemplate({ name: "Pricing" });
  const a = await attachAutomation(entry.id, checklist.id, {
    delayMinutes: 60,
    position: 0,
  });
  const b = await attachAutomation(entry.id, intro.id, {
    delayMinutes: 60,
    position: 1,
  });
  const c = await attachAutomation(entry.id, pricing.id, {
    delayMinutes: 60,
    position: 2,
  });

  await reorderAutomations({
    stage: entry.id,
    orderedIds: [c.id, a.id, b.id],
  });

  const journey = await loadJourney();
  const column = journey.stages.find((s) => s.id === entry.id)!;
  expect(column.automations.map((x) => x.templateName)).toEqual([
    "Pricing",
    "Checklist",
    "Intro",
  ]);

  // Survives a reload — the order lives in the rows, not the session.
  const again = await loadJourney();
  expect(
    again.stages
      .find((s) => s.id === entry.id)!
      .automations.map((x) => x.templateName),
  ).toEqual(["Pricing", "Checklist", "Intro"]);
});

test("detaching keeps the template, shelves it, and cancels its in-flight sends", async () => {
  const entry = await stageByName("New");
  const nurture = await createTemplate({ name: "Nurture" });
  const welcome = await createTemplate({ name: "Welcome" });
  const detached = await attachAutomation(entry.id, nurture.id, {
    delayMinutes: 60,
    position: 0,
  });
  await attachAutomation(entry.id, welcome.id, {
    delayMinutes: 0,
    position: 1,
  });

  // A lead mid-sequence: welcome already delivered, nurture still queued.
  const lead = await createLead({ stageId: entry.id });
  await createEmailJob(lead.id, welcome.id, {
    status: "sent",
    sentAt: new Date(),
  });
  const queued = await createEmailJob(lead.id, nurture.id, {
    sendAt: new Date(Date.now() + 60 * 60_000),
  });

  await removeAutomation({ id: detached.id, stage: entry.id });

  const journey = await loadJourney();
  const column = journey.stages.find((s) => s.id === entry.id)!;
  expect(column.automations.map((a) => a.templateName)).toEqual(["Welcome"]);

  // The template survives the detach and is offered for reuse on the shelf.
  expect(journey.unattached).toEqual([
    expect.objectContaining({ id: nurture.id, name: "Nurture" }),
  ]);

  // The queued send is reconciled away; history is left alone.
  const jobs = await jobsForLead(lead.id);
  expect(jobs.find((j) => j.id === queued.id)?.status).toBe("cancelled");
  expect(jobs.find((j) => j.templateId === welcome.id)?.status).toBe("sent");
});
