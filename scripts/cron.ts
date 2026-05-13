// Bun v1.3 runtime. Runs on Railway to drive the email-jobs cron on Vercel.
import { z } from "zod@3";

const baseUrl = process.env.APP_BASE_URL;
const secret = process.env.CRON_SECRET;

if (!baseUrl) throw new Error("APP_BASE_URL is required");
if (!secret) throw new Error("CRON_SECRET is required");

const response = z.object({
  ok: z.literal(true),
  picked: z.number(),
  sent: z.number(),
  cancelled: z.number(),
  retried: z.number(),
  failed: z.number(),
});

const url = new URL("/api/cron/email-jobs", baseUrl).toString();
const startedAt = Date.now();

const res = await fetch(url, {
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
      url,
      status: res.status,
      durationMs,
      body: body.slice(0, 1000),
    }),
  );
  process.exit(1);
}

const stats = response.parse(await res.json());

console.log(
  JSON.stringify({
    level: "info",
    url,
    status: res.status,
    durationMs,
    ...stats,
  }),
);
