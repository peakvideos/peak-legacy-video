import { beforeEach, inject } from "vitest";
import { smtp } from "./stubs/nodemailer";
import { resetTestRequestHeaders } from "./stubs/next-headers";

// This file runs in each worker before any test file is imported, so the
// environment is fully pinned before app modules (which read env at import
// time) ever load. Nothing here may import app code statically.

process.env.DATABASE_URL = inject("testDatabaseUrl");

process.env.BETTER_AUTH_SECRET = "test-only-secret";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
process.env.CRON_SECRET = "test-cron-secret";

// SMTP must look configured so the send path runs into the nodemailer fake
// instead of short-circuiting at isEmailConfigured().
process.env.GMAIL_SMTP_USER = "fake-sender@test.local";
process.env.GMAIL_SMTP_PASSWORD = "fake-app-password";
process.env.EMAIL_FROM = "Peak Studios CO <fake-sender@test.local>";
process.env.OWNER_NOTIFICATION_EMAIL = "owner-inbox@test.local";

// Owner account creation for server-action tests.
process.env.OWNER_EMAILS = "owner@test.local";
process.env.ALLOW_SIGNUP = "true";

// Google Calendar stays unconfigured: the booking route skips event creation.
delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
delete process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

beforeEach(async () => {
  // Imported lazily so the env above is set before lib/db loads.
  const { resetDatabase } = await import("./helpers/db");
  await resetDatabase();
  smtp.reset();
  resetTestRequestHeaders();
});
