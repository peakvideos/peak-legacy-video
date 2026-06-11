import { beforeEach, expect, test } from "vitest";
import { GET as runWorker } from "@/app/api/cron/email-jobs/route";
import {
  archiveTemplate,
  getTemplateForEditor,
  updateTemplateContent,
} from "@/app/admin/journey/actions";
import { listActiveTemplatesForComposer } from "@/app/admin/actions";
import { loadJourney } from "@/lib/admin/journey";
import { smtp } from "./stubs/nodemailer";
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

const MINUTE = 60_000;

function cronRequest() {
  return new Request("http://localhost:3000/api/cron/email-jobs", {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

beforeEach(async () => {
  await signInAsOwner();
});

test("editing a template from the journey updates its card and a queued send goes out with the edited content", async () => {
  const entry = await stageByName("New");
  const welcome = await createTemplate({
    name: "Welcome",
    subject: "Old subject",
    body: tiptapDoc("Old body."),
  });
  await attachAutomation(entry.id, welcome.id, { delayMinutes: 0 });
  const lead = await createLead({
    stageId: entry.id,
    firstName: "Rosie",
    email: "rosie@example.com",
  });
  await createEmailJob(lead.id, welcome.id, {
    sendAt: new Date(Date.now() - MINUTE),
  });

  await updateTemplateContent({
    id: welcome.id,
    subject: "Fresh subject for {{firstName}}",
    body: tiptapDoc("Hi {{firstName}}, the details changed."),
  });

  // The journey card shows the edited subject…
  const journey = await loadJourney();
  const column = journey.stages.find((s) => s.id === entry.id)!;
  expect(column.automations[0].templateSubject).toBe(
    "Fresh subject for {{firstName}}",
  );

  // …and the in-flight job is rendered from the edited template at send time.
  await runWorker(cronRequest());
  expect(smtp.sent).toHaveLength(1);
  expect(smtp.sent[0].subject).toBe("Fresh subject for Rosie");
  expect(smtp.sent[0].html).toContain("Hi Rosie, the details changed.");
});

test("a blank subject is rejected and the stored template is untouched", async () => {
  const welcome = await createTemplate({
    name: "Welcome",
    subject: "Original subject",
    body: tiptapDoc("Original body."),
  });

  await expect(
    updateTemplateContent({
      id: welcome.id,
      subject: "   ",
      body: tiptapDoc("New body."),
    }),
  ).rejects.toThrow(/subject/i);

  const journey = await loadJourney();
  expect(journey.unattached).toEqual([
    expect.objectContaining({ id: welcome.id, subject: "Original subject" }),
  ]);
});

test("archiving a template cancels its in-flight sends for every lead and leaves history alone", async () => {
  const entry = await stageByName("New");
  const nurture = await createTemplate({ name: "Nurture" });
  const welcome = await createTemplate({ name: "Welcome" });
  await attachAutomation(entry.id, nurture.id, { delayMinutes: 60 });
  await attachAutomation(entry.id, welcome.id, { delayMinutes: 0 });

  // Two leads mid-sequence with nurture queued; one already got welcome.
  const rosie = await createLead({ stageId: entry.id });
  const stan = await createLead({ stageId: entry.id });
  await createEmailJob(rosie.id, welcome.id, {
    status: "sent",
    sentAt: new Date(),
  });
  const rosieQueued = await createEmailJob(rosie.id, nurture.id, {
    sendAt: new Date(Date.now() + 60 * MINUTE),
  });
  const stanQueued = await createEmailJob(stan.id, nurture.id, {
    sendAt: new Date(Date.now() + 60 * MINUTE),
  });

  await archiveTemplate(nurture.id);

  // Every in-flight pending send of the template is cancelled…
  const rosieJobs = await jobsForLead(rosie.id);
  expect(rosieJobs.find((j) => j.id === rosieQueued.id)?.status).toBe(
    "cancelled",
  );
  const stanJobs = await jobsForLead(stan.id);
  expect(stanJobs.find((j) => j.id === stanQueued.id)?.status).toBe(
    "cancelled",
  );
  // …while delivered history stays exactly as it happened.
  expect(rosieJobs.find((j) => j.templateId === welcome.id)?.status).toBe(
    "sent",
  );

  // The template leaves the journey: no card anywhere, not on the shelf.
  const journey = await loadJourney();
  const column = journey.stages.find((s) => s.id === entry.id)!;
  expect(column.automations.map((a) => a.templateName)).toEqual(["Welcome"]);
  expect(journey.unattached).toEqual([]);
});

test("the slide-over editor loads a template's name, subject, and body by id", async () => {
  const welcome = await createTemplate({
    name: "Welcome",
    subject: "Hello {{firstName}}",
    body: tiptapDoc("Glad you're here."),
  });

  const template = await getTemplateForEditor(welcome.id);
  expect(template).toEqual(
    expect.objectContaining({
      id: welcome.id,
      name: "Welcome",
      subject: "Hello {{firstName}}",
      body: tiptapDoc("Glad you're here."),
    }),
  );

  await expect(
    getTemplateForEditor("00000000-0000-0000-0000-000000000000"),
  ).rejects.toThrow(/not found/i);
});

test("an archived template leaves the one-off composer's picker; active ones stay", async () => {
  const keep = await createTemplate({ name: "Keep me" });
  const retire = await createTemplate({ name: "Retire me" });

  await archiveTemplate(retire.id);

  const pickable = await listActiveTemplatesForComposer();
  expect(pickable.map((t) => t.id)).toContain(keep.id);
  expect(pickable.map((t) => t.id)).not.toContain(retire.id);
});
