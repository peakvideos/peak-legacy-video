import { beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailJobs } from "@/lib/db/schema";
import { loadOutboxPending } from "@/lib/admin/outbox";
import {
  cancelEmailJob,
  previewEmailJob,
  sendEmailJobNow,
} from "@/app/admin/actions";
import { GET as runWorker } from "@/app/api/cron/email-jobs/route";
import { smtp } from "./stubs/nodemailer";
import { signInAsOwner } from "./helpers/auth";
import {
  attachAutomation,
  createEmailJob,
  createLead,
  createTemplate,
  tiptapDoc,
} from "./helpers/fixtures";

const MINUTE = 60_000;

function cronRequest(secret = "test-cron-secret") {
  return new Request("http://localhost:3000/api/cron/email-jobs", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

beforeEach(async () => {
  await signInAsOwner();
});

async function reloadJob(id: string) {
  const [row] = await db.select().from(emailJobs).where(eq(emailJobs.id, id));
  return row;
}

test("the outbox lists every pending job across all leads in send order, with recipient, template, and send time", async () => {
  const template = await createTemplate({ name: "Welcome" });
  const laterTemplate = await createTemplate({ name: "Follow-up" });
  const rosie = await createLead({
    firstName: "Rosie",
    lastName: "Larsen",
    email: "rosie@example.com",
  });
  const stan = await createLead({
    firstName: "Stan",
    lastName: "Marsh",
    email: "stan@example.com",
  });
  // Interleaved send times across the two leads — the outbox orders by
  // send time globally, not grouped by lead.
  await createEmailJob(rosie.id, laterTemplate.id, {
    sendAt: new Date(Date.now() + 60 * MINUTE),
  });
  await createEmailJob(stan.id, template.id, {
    sendAt: new Date(Date.now() + 5 * MINUTE),
  });
  await createEmailJob(rosie.id, template.id, {
    sendAt: new Date(Date.now() + 30 * MINUTE),
  });

  const rows = await loadOutboxPending();

  expect(rows).toHaveLength(3);
  expect(
    rows.map((r) => [r.recipientEmail, r.templateName]),
  ).toEqual([
    ["stan@example.com", "Welcome"],
    ["rosie@example.com", "Welcome"],
    ["rosie@example.com", "Follow-up"],
  ]);
  const [first] = rows;
  expect(first.recipientName).toBe("Stan Marsh");
  expect(first.leadId).toBe(stan.id);
  expect(first.sendAt).toBeInstanceOf(Date);
  expect(rows[1].sendAt.getTime()).toBeGreaterThan(first.sendAt.getTime());
});

test("sent, cancelled, and failed jobs never appear in the outbox", async () => {
  const template = await createTemplate();
  const lead = await createLead();
  await createEmailJob(lead.id, template.id, { status: "sent" });
  await createEmailJob(lead.id, template.id, { status: "cancelled" });
  await createEmailJob(lead.id, template.id, { status: "failed" });
  const pending = await createEmailJob(lead.id, template.id);

  const rows = await loadOutboxPending();

  expect(rows.map((r) => r.id)).toEqual([pending.id]);
});

test("a job's preview is byte-for-byte what the send worker later delivers", async () => {
  const lead = await createLead({
    firstName: "Rosie",
    email: "rosie@example.com",
  });
  const template = await createTemplate({
    subject: "For {{firstName}}",
    body: tiptapDoc("Hi {{firstName}}, your inbox is {{email}}."),
  });
  await attachAutomation(lead.stageId, template.id);
  const job = await createEmailJob(lead.id, template.id, {
    sendAt: new Date(Date.now() - MINUTE),
  });

  const preview = await previewEmailJob(job.id);

  // Variables are filled in, not left as placeholders.
  expect(preview.subject).toBe("For Rosie");
  expect(preview.html).toContain("Hi Rosie, your inbox is rosie@example.com.");

  // The worker now actually sends it — the delivered email must be exactly
  // the preview, unsubscribe footer and all.
  await runWorker(cronRequest());
  expect(smtp.sent).toHaveLength(1);
  expect(smtp.sent[0].to).toBe("rosie@example.com");
  expect(smtp.sent[0].subject).toBe(preview.subject);
  expect(smtp.sent[0].html).toBe(preview.html);
  expect(smtp.sent[0].text).toBe(preview.text);
});

test("send now delivers a not-yet-due job immediately and records it exactly like a scheduled send", async () => {
  const lead = await createLead({
    firstName: "Rosie",
    email: "rosie@example.com",
  });
  const template = await createTemplate({ subject: "For {{firstName}}" });
  await attachAutomation(lead.stageId, template.id);
  const job = await createEmailJob(lead.id, template.id, {
    sendAt: new Date(Date.now() + 60 * MINUTE),
  });

  const result = await sendEmailJobNow(job.id);

  expect(result).toMatchObject({ outcome: "sent" });
  expect(smtp.sent).toHaveLength(1);
  expect(smtp.sent[0].to).toBe("rosie@example.com");
  expect(smtp.sent[0].subject).toBe("For Rosie");

  const updated = await reloadJob(job.id);
  expect(updated.status).toBe("sent");
  expect(updated.sentAt).not.toBeNull();
  expect(updated.messageId).toBe("<test-1@smtp.fake>");

  // The cron worker has nothing left to pick up — no double send.
  await runWorker(cronRequest());
  expect(smtp.sent).toHaveLength(1);
});

test("an SMTP failure on send now backs the job off for retry, exactly like a scheduled send", async () => {
  const lead = await createLead();
  const template = await createTemplate();
  await attachAutomation(lead.stageId, template.id);
  const job = await createEmailJob(lead.id, template.id, {
    sendAt: new Date(Date.now() + 60 * MINUTE),
  });
  smtp.failNext("421 Service not available");

  const before = Date.now();
  const result = await sendEmailJobNow(job.id);

  expect(result.outcome).toBe("retried");

  const updated = await reloadJob(job.id);
  expect(updated.status).toBe("pending");
  expect(updated.attempts).toBe(1);
  expect(updated.lastError).toContain("421 Service not available");
  // First retry backs off 5 minutes, same as the worker.
  expect(updated.sendAt.getTime()).toBeGreaterThanOrEqual(before + 5 * MINUTE);
  expect(updated.sendAt.getTime()).toBeLessThanOrEqual(
    Date.now() + 5 * MINUTE + 1000,
  );
});

test("a send now that fails on the job's fifth attempt marks it failed for good", async () => {
  const lead = await createLead();
  const template = await createTemplate();
  await attachAutomation(lead.stageId, template.id);
  const job = await createEmailJob(lead.id, template.id, {
    sendAt: new Date(Date.now() + 60 * MINUTE),
    attempts: 4,
  });
  smtp.failNext("550 Mailbox unavailable");

  const result = await sendEmailJobNow(job.id);

  expect(result.outcome).toBe("failed");

  const updated = await reloadJob(job.id);
  expect(updated.status).toBe("failed");
  expect(updated.attempts).toBe(5);
  expect(updated.lastError).toContain("550 Mailbox unavailable");
});

test("send now to an unsubscribed lead cancels the job instead of emailing them", async () => {
  const lead = await createLead({ unsubscribedAt: new Date() });
  const template = await createTemplate();
  await attachAutomation(lead.stageId, template.id);
  const job = await createEmailJob(lead.id, template.id, {
    sendAt: new Date(Date.now() + 60 * MINUTE),
  });

  const result = await sendEmailJobNow(job.id);

  expect(result.outcome).toBe("cancelled");
  expect(smtp.sent).toHaveLength(0);
  expect((await reloadJob(job.id)).status).toBe("cancelled");
});

test("send now refuses a job that is no longer pending — sent history is never re-sent", async () => {
  const lead = await createLead();
  const template = await createTemplate();
  await attachAutomation(lead.stageId, template.id);
  const job = await createEmailJob(lead.id, template.id, {
    status: "sent",
    sentAt: new Date(),
  });

  await expect(sendEmailJobNow(job.id)).rejects.toThrow(/not pending/i);
  expect(smtp.sent).toHaveLength(0);
  expect((await reloadJob(job.id)).status).toBe("sent");
});

test("cancelling a pending job removes it from the outbox and the worker never sends it", async () => {
  const lead = await createLead();
  const template = await createTemplate();
  await attachAutomation(lead.stageId, template.id);
  const job = await createEmailJob(lead.id, template.id, {
    sendAt: new Date(Date.now() - MINUTE),
  });

  await cancelEmailJob(job.id);

  expect((await reloadJob(job.id)).status).toBe("cancelled");
  expect(await loadOutboxPending()).toHaveLength(0);

  // Even though the job was already due, the worker leaves it alone.
  await runWorker(cronRequest());
  expect(smtp.sent).toHaveLength(0);
});

test("a job that already went out cannot be cancelled — history stays intact", async () => {
  const lead = await createLead();
  const template = await createTemplate();
  const job = await createEmailJob(lead.id, template.id, {
    status: "sent",
    sentAt: new Date(),
  });

  await expect(cancelEmailJob(job.id)).rejects.toThrow(/not pending/i);
  expect((await reloadJob(job.id)).status).toBe("sent");
});
