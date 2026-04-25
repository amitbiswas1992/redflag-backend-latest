ALTER TABLE "encounter_analytics" ADD COLUMN IF NOT EXISTS "controlled_substance_prescribed" boolean;--> statement-breakpoint
ALTER TABLE "encounter_analytics" ADD COLUMN IF NOT EXISTS "medication_prescribed" text;--> statement-breakpoint
ALTER TABLE "encounter_analytics" ADD COLUMN IF NOT EXISTS "prescriber_dea" text;--> statement-breakpoint
ALTER TABLE "encounter_analytics" ADD COLUMN IF NOT EXISTS "auto_refill_policy_corporate_mandated" boolean;--> statement-breakpoint

ALTER TABLE "medication_analytics" ADD COLUMN IF NOT EXISTS "follow_up_scheduled" boolean;--> statement-breakpoint
ALTER TABLE "medication_analytics" ADD COLUMN IF NOT EXISTS "care_plan_updated" boolean;--> statement-breakpoint
ALTER TABLE "medication_analytics" ADD COLUMN IF NOT EXISTS "vital_signs_recorded" boolean;--> statement-breakpoint
ALTER TABLE "medication_analytics" ADD COLUMN IF NOT EXISTS "coordination_with_pcp" boolean;--> statement-breakpoint
ALTER TABLE "medication_analytics" ADD COLUMN IF NOT EXISTS "clinical_decision_support" boolean;--> statement-breakpoint
ALTER TABLE "medication_analytics" ADD COLUMN IF NOT EXISTS "cds_alert_count" integer;--> statement-breakpoint
ALTER TABLE "medication_analytics" ADD COLUMN IF NOT EXISTS "override_reason" text;