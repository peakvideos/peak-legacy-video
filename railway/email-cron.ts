// Bun v1.3 runtime. Runs on Railway every 5 minutes and does two things:
//   1. Drives the email-jobs queue on Vercel.
//   2. Probes /api/health so a dead integration (calendar token, SMTP,
//      stalled queue) turns this run into a visible failure.
//
// This file is the source of truth — the deployed copy lives in the
// "function-bun" service of the Peak Legacy Video Railway project. Deploy
// changes with:
//   railway functions push -p railway/email-cron.ts
// (from a directory linked to the project; see docs/dev/README.md)
import { z } from "zod@3";

const baseUrl = process.env.APP_BASE_URL;
const secret = process.env.CRON_SECRET;

if (!baseUrl) throw new Error("APP_BASE_URL is required");
if (!secret) throw new Error("CRON_SECRET is required");

let failed = false;

// ── 1. Drive the email queue ─────────────────────────────────────

const cronResponse = z.object({
  ok: z.literal(true),
  picked: z.number(),
  sent: z.number(),
  cancelled: z.number(),
  retried: z.number(),
  failed: z.number(),
});

const cronUrl = new URL("/api/cron/email-jobs", baseUrl).toString();
{
  const startedAt = Date.now();
  const res = await fetch(cronUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
  });
  const durationMs = Date.now() - startedAt;

  if (!res.ok) {
    const body = await res.text();
    console.error(
      JSON.stringify({
        level: "error",
        url: cronUrl,
        status: res.status,
        durationMs,
        body: body.slice(0, 1000),
      }),
    );
    failed = true;
  } else {
    const stats = cronResponse.parse(await res.json());
    console.log(
      JSON.stringify({
        level: "info",
        url: cronUrl,
        status: res.status,
        durationMs,
        ...stats,
      }),
    );
  }
}

// ── 2. Probe integration health ──────────────────────────────────
// Runs after the queue drain so a just-processed queue reads healthy.
// /api/health exercises the Google Calendar refresh token (live freebusy
// call), flags a stalled queue (pending job >30min overdue), and flags
// recent delivery failures (jobs that exhausted retries in the last 24h).

const healthResponse = z.object({
  ok: z.boolean(),
  checks: z.record(z.string()),
});

const healthUrl = new URL("/api/health", baseUrl).toString();
{
  const startedAt = Date.now();
  const res = await fetch(healthUrl);
  const durationMs = Date.now() - startedAt;

  if (res.status === 404) {
    // Health endpoint not deployed yet — warn, don't fail the run.
    console.warn(
      JSON.stringify({
        level: "warn",
        url: healthUrl,
        status: 404,
        durationMs,
        note: "health endpoint not deployed yet",
      }),
    );
  } else {
    const body = await res.text();
    let parsed: z.infer<typeof healthResponse> | null = null;
    try {
      parsed = healthResponse.parse(JSON.parse(body));
    } catch {
      // fall through to the error branch with the raw body
    }

    if (res.ok && parsed?.ok) {
      console.log(
        JSON.stringify({
          level: "info",
          url: healthUrl,
          status: res.status,
          durationMs,
          ...parsed.checks,
        }),
      );
    } else {
      console.error(
        JSON.stringify({
          level: "error",
          url: healthUrl,
          status: res.status,
          durationMs,
          body: body.slice(0, 1000),
        }),
      );
      failed = true;
    }
  }
}

if (failed) process.exit(1);
