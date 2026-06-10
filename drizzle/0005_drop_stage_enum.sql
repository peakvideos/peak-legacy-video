DROP INDEX "leads_stage_idx";--> statement-breakpoint
DROP INDEX "stage_automations_stage_idx";--> statement-breakpoint
DROP INDEX "stage_automations_stage_template_uniq";--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "stage_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stage_automations" ALTER COLUMN "stage_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "leads_stage_id_idx" ON "leads" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "stage_automations_stage_id_idx" ON "stage_automations" USING btree ("stage_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "stage_automations_stage_template_uniq" ON "stage_automations" USING btree ("stage_id","template_id");--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "stage";--> statement-breakpoint
ALTER TABLE "stage_automations" DROP COLUMN "stage";--> statement-breakpoint
DROP TYPE "public"."lead_stage";