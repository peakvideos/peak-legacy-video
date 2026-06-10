ALTER TABLE "leads" ADD COLUMN "stage_id" uuid;--> statement-breakpoint
ALTER TABLE "stage_automations" ADD COLUMN "stage_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_automations" ADD CONSTRAINT "stage_automations_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill from the old enum column onto the stages rows seeded by the
-- previous migration (matched by their seeded board positions).
UPDATE "leads" SET "stage_id" = s."id"
FROM "stages" s
WHERE s."position" = CASE "leads"."stage"
	WHEN 'new' THEN 0
	WHEN 'stale' THEN 1
	WHEN 'booked_a_call' THEN 2
	WHEN 'call_completed' THEN 3
	WHEN 'video_shoot_scheduled' THEN 4
	WHEN 'post_video_shoot' THEN 5
	WHEN 'closed' THEN 6
	WHEN 'lost' THEN 7
END;
--> statement-breakpoint
UPDATE "stage_automations" SET "stage_id" = s."id"
FROM "stages" s
WHERE s."position" = CASE "stage_automations"."stage"
	WHEN 'new' THEN 0
	WHEN 'stale' THEN 1
	WHEN 'booked_a_call' THEN 2
	WHEN 'call_completed' THEN 3
	WHEN 'video_shoot_scheduled' THEN 4
	WHEN 'post_video_shoot' THEN 5
	WHEN 'closed' THEN 6
	WHEN 'lost' THEN 7
END;
