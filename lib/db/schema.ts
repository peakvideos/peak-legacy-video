import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────────────────

export const packageInterest = pgEnum("package_interest", [
  "legacy",
  "heirloom",
  "unsure",
]);

export const leadStage = pgEnum("lead_stage", [
  "new",
  "stale",
  "booked_a_call",
  "call_completed",
  "video_shoot_scheduled",
  "post_video_shoot",
  "closed",
  "lost",
]);

export const bookingStatus = pgEnum("booking_status", [
  "scheduled",
  "cancelled",
  "completed",
]);

export const emailJobStatus = pgEnum("email_job_status", [
  "pending",
  "sent",
  "cancelled",
  "failed",
]);

// ── Application tables ────────────────────────────────────────────

export const leads = pgTable(
  "leads",
  {
    id: uuid().primaryKey().defaultRandom(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    email: text().notNull().unique(),
    phone: text(),
    packageInterest: packageInterest().notNull().default("unsure"),
    notes: text(),
    source: text().notNull().default("landing_page"),
    utmSource: text(),
    utmMedium: text(),
    utmCampaign: text(),
    utmContent: text(),
    utmTerm: text(),
    stage: leadStage().notNull().default("new"),
    crmNotes: text(),
    unsubscribedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("leads_created_at_idx").on(t.createdAt),
    index("leads_stage_idx").on(t.stage),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    scheduledAt: timestamp({ withTimezone: true }).notNull(),
    gcalEventId: text(),
    status: bookingStatus().notNull().default("scheduled"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("bookings_lead_id_idx").on(t.leadId),
    index("bookings_scheduled_at_idx").on(t.scheduledAt),
  ],
);

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    subject: text().notNull(),
    /** Tiptap JSON document. Rendered to HTML at send time, with `{{variable}}` substitution. */
    body: jsonb().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export const stageAutomations = pgTable(
  "stage_automations",
  {
    id: uuid().primaryKey().defaultRandom(),
    stage: leadStage().notNull(),
    templateId: uuid()
      .notNull()
      .references(() => emailTemplates.id, { onDelete: "restrict" }),
    delayMinutes: integer().notNull().default(0),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("stage_automations_stage_idx").on(t.stage, t.position),
    uniqueIndex("stage_automations_stage_template_uniq").on(t.stage, t.templateId),
  ],
);

export const emailJobs = pgTable(
  "email_jobs",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    templateId: uuid()
      .notNull()
      .references(() => emailTemplates.id, { onDelete: "restrict" }),
    sendAt: timestamp({ withTimezone: true }).notNull(),
    sentAt: timestamp({ withTimezone: true }),
    status: emailJobStatus().notNull().default("pending"),
    attempts: integer().notNull().default(0),
    lastError: text(),
    messageId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("email_jobs_status_send_at_idx").on(t.status, t.sendAt),
    index("email_jobs_lead_id_idx").on(t.leadId),
    index("email_jobs_template_id_idx").on(t.templateId),
  ],
);

// ── BetterAuth tables ─────────────────────────────────────────────
// Column casing is snake_case (matches drizzle.config). BetterAuth's
// default field names are camelCase; we map them via the auth config's
// `fields` option in Phase 5. Table names are pluralized (Postgres
// convention) and aliased via `modelName` in the auth config.

export const users = pgTable("users", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: text().notNull().default("user"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

// ── Relations ─────────────────────────────────────────────────────

export const leadsRelations = relations(leads, ({ many }) => ({
  bookings: many(bookings),
  emailJobs: many(emailJobs),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  lead: one(leads, { fields: [bookings.leadId], references: [leads.id] }),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ many }) => ({
  emailJobs: many(emailJobs),
  stageAutomations: many(stageAutomations),
}));

export const stageAutomationsRelations = relations(
  stageAutomations,
  ({ one }) => ({
    template: one(emailTemplates, {
      fields: [stageAutomations.templateId],
      references: [emailTemplates.id],
    }),
  }),
);

export const emailJobsRelations = relations(emailJobs, ({ one }) => ({
  lead: one(leads, { fields: [emailJobs.leadId], references: [leads.id] }),
  template: one(emailTemplates, {
    fields: [emailJobs.templateId],
    references: [emailTemplates.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));
