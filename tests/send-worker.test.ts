import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "@/lib/db";
import { emailJobs } from "@/lib/db/schema";
import { GET as runWorker } from "@/app/api/cron/email-jobs/route";
import { getSettings } from "@/lib/stages/settings";
import { smtp } from "./stubs/nodemailer";
import {
  attachAutomation,
  createEmailJob,
  createLead,
  createTemplate,
  stageByName,
  tiptapDoc,
} from "./helpers/fixtures";

const MINUTE = 60_000;

function cronRequest(secret = "test-cron-secret") {
  return new Request("http://localhost:3000/api/cron/email-jobs", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

/**
 * A lead with a due, deliverable job: the template is attached to the
 * lead's current stage, which the worker requires to consider a job still
 * relevant.
 */
async function dueJob(args: {
  lead?: Parameters<typeof createLead>[0];
  template?: Parameters<typeof createTemplate>[0];
  job?: Record<string, unknown>;
} = {}) {
  const lead = await createLead(args.lead);
  const template = await createTemplate(args.template);
  await attachAutomation(lead.stageId, template.id);
  const job = await createEmailJob(lead.id, template.id, {
    sendAt: new Date(Date.now() - MINUTE),
    ...args.job,
  });
  return { lead, template, job };
}

async function reloadJob(id: string) {
  const [row] = await db.select().from(emailJobs).where(eq(emailJobs.id, id));
  return row;
}

test("a due job is rendered with the lead's variables, sent, and marked sent with the SMTP message id", async () => {
  const { lead, job } = await dueJob({
    lead: { firstName: "Rosie", email: "rosie@example.com" },
    template: {
      subject: "For {{firstName}}",
      body: tiptapDoc("Hi {{firstName}}, your inbox is {{email}}."),
    },
  });

  const res = await runWorker(cronRequest());

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, picked: 1, sent: 1 });

  expect(smtp.sent).toHaveLength(1);
  const mail = smtp.sent[0];
  expect(mail.to).toBe("rosie@example.com");
  expect(mail.subject).toBe("For Rosie");
  expect(mail.html).toContain("Hi Rosie, your inbox is rosie@example.com.");
  // Every automation email carries the lead's signed unsubscribe link
  // (HTML-escaped inside the footer's href).
  expect(mail.html).toContain(`/unsubscribe?lead=${lead.id}&amp;token=`);

  const updated = await reloadJob(job.id);
  expect(updated.status).toBe("sent");
  expect(updated.sentAt).not.toBeNull();
  expect(updated.messageId).toBe("<test-1@smtp.fake>");
});

test("a batch picks up at most 25 due jobs, oldest first; the rest wait for the next run", async () => {
  const { entryStageId } = await getSettings();
  const template = await createTemplate();
  await attachAutomation(entryStageId, template.id);
  for (let i = 0; i < 30; i++) {
    const lead = await createLead();
    // Oldest jobs first: index 0 is the most overdue.
    await createEmailJob(lead.id, template.id, {
      sendAt: new Date(Date.now() - (30 - i) * MINUTE),
    });
  }

  const res = await runWorker(cronRequest());

  expect(await res.json()).toMatchObject({ picked: 25, sent: 25 });
  expect(smtp.sent).toHaveLength(25);

  const remaining = await db
    .select()
    .from(emailJobs)
    .where(eq(emailJobs.status, "pending"))
    .orderBy(emailJobs.sendAt);
  expect(remaining).toHaveLength(5);
});

test("jobs that are not due yet are left untouched", async () => {
  await dueJob({ job: { sendAt: new Date(Date.now() + 10 * MINUTE) } });

  const res = await runWorker(cronRequest());

  expect(await res.json()).toMatchObject({ picked: 0, sent: 0 });
  expect(smtp.sent).toHaveLength(0);
});

test("an SMTP failure backs the job off for retry instead of losing it", async () => {
  const { job } = await dueJob();
  smtp.failNext("421 Service not available");

  const before = Date.now();
  const res = await runWorker(cronRequest());

  expect(await res.json()).toMatchObject({ picked: 1, retried: 1, failed: 0 });

  const updated = await reloadJob(job.id);
  expect(updated.status).toBe("pending");
  expect(updated.attempts).toBe(1);
  expect(updated.lastError).toContain("421 Service not available");
  // First retry backs off 5 minutes.
  expect(updated.sendAt.getTime()).toBeGreaterThanOrEqual(before + 5 * MINUTE);
  expect(updated.sendAt.getTime()).toBeLessThanOrEqual(
    Date.now() + 5 * MINUTE + 1000,
  );
});

test("a job that keeps failing is marked failed on its fifth attempt and never retried again", async () => {
  const { job } = await dueJob({ job: { attempts: 4 } });
  smtp.failNext("550 Mailbox unavailable");

  const res = await runWorker(cronRequest());

  expect(await res.json()).toMatchObject({ picked: 1, retried: 0, failed: 1 });

  const updated = await reloadJob(job.id);
  expect(updated.status).toBe("failed");
  expect(updated.attempts).toBe(5);
  expect(updated.lastError).toContain("550 Mailbox unavailable");

  // A later run leaves failed jobs alone.
  expect(await (await runWorker(cronRequest())).json()).toMatchObject({
    picked: 0,
  });
});

test("due jobs for an unsubscribed lead are cancelled without sending", async () => {
  const { job } = await dueJob({ lead: { unsubscribedAt: new Date() } });

  const res = await runWorker(cronRequest());

  expect(await res.json()).toMatchObject({ picked: 1, cancelled: 1, sent: 0 });
  expect(smtp.sent).toHaveLength(0);
  expect((await reloadJob(job.id)).status).toBe("cancelled");
});

test("due jobs whose template was archived are cancelled without sending", async () => {
  const { job } = await dueJob({ template: { archivedAt: new Date() } });

  const res = await runWorker(cronRequest());

  expect(await res.json()).toMatchObject({ picked: 1, cancelled: 1, sent: 0 });
  expect(smtp.sent).toHaveLength(0);
  expect((await reloadJob(job.id)).status).toBe("cancelled");
});

test("due jobs whose template is no longer an automation of the lead's current stage are cancelled", async () => {
  // The template is attached to the Entry Stage, but the lead has since moved.
  const { entryStageId } = await getSettings();
  const stale = await stageByName("Stale");
  const lead = await createLead({ stageId: stale.id });
  const template = await createTemplate();
  await attachAutomation(entryStageId, template.id);
  const job = await createEmailJob(lead.id, template.id, {
    sendAt: new Date(Date.now() - MINUTE),
  });

  const res = await runWorker(cronRequest());

  expect(await res.json()).toMatchObject({ picked: 1, cancelled: 1, sent: 0 });
  expect(smtp.sent).toHaveLength(0);
  expect((await reloadJob(job.id)).status).toBe("cancelled");
});

test("the worker rejects requests without the cron secret", async () => {
  await dueJob();

  const res = await runWorker(
    new Request("http://localhost:3000/api/cron/email-jobs"),
  );

  expect(res.status).toBe(401);
  expect(smtp.sent).toHaveLength(0);
  const [job] = await db.select().from(emailJobs);
  expect(job.status).toBe("pending");
});
