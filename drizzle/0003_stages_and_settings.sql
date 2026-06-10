CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"entry_stage_id" uuid NOT NULL,
	"booking_stage_id" uuid NOT NULL,
	"cold_threshold_days" integer DEFAULT 14 NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	"needs_action" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_entry_stage_id_stages_id_fk" FOREIGN KEY ("entry_stage_id") REFERENCES "public"."stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_booking_stage_id_stages_id_fk" FOREIGN KEY ("booking_stage_id") REFERENCES "public"."stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stages_position_idx" ON "stages" USING btree ("position");--> statement-breakpoint
-- Seed the eight stages the pipeline shipped with, reproducing the old
-- hardcoded enum's behavior exactly. Kept in sync with lib/stages/defaults.ts.
INSERT INTO "stages" ("name", "color", "description", "position", "is_won", "is_lost", "needs_action") VALUES
	('New', 'gold', 'Fresh leads from the form/booking modal land here.', 0, false, false, false),
	('Stale', 'tofino', 'Move leads here once they''ve gone cold.', 1, false, false, false),
	('Booked a call', 'gold-soft', 'Discovery calls scheduled show here.', 2, false, false, false),
	('Call completed', 'sky', 'Move leads here after the discovery call.', 3, false, false, true),
	('Video shoot scheduled', 'moss', 'Move leads here once the shoot is booked.', 4, false, false, false),
	('Post video shoot', 'blush-soft', 'Move leads here after the shoot wraps.', 5, false, false, true),
	('Closed', 'forest', 'Drop or move leads here once paid.', 6, true, false, false),
	('Lost', 'blush', 'Drop or move leads here when they don''t convert.', 7, false, true, false);
--> statement-breakpoint
-- Entry = the seeded position-0 stage, Booking = the seeded position-2 stage.
INSERT INTO "settings" ("id", "entry_stage_id", "booking_stage_id")
SELECT 1, e."id", b."id"
FROM (SELECT "id" FROM "stages" WHERE "position" = 0) e,
     (SELECT "id" FROM "stages" WHERE "position" = 2) b;
