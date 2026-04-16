ALTER TYPE "public"."ingestion_job_status" ADD VALUE IF NOT EXISTS 'DETECTING';
--> statement-breakpoint
ALTER TYPE "public"."ingestion_job_status" ADD VALUE IF NOT EXISTS 'AWAITING_CONFIRMATION';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_encounter_analytics_org" ON "encounter_analytics" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_encounter_analytics_rule_hot_path" ON "encounter_analytics" USING btree ("is_telehealth", "documentation_complete", "cross_state_flag");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_medication_analytics_org" ON "medication_analytics" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_medication_analytics_rule_hot_path" ON "medication_analytics" USING btree ("controlled_substance", "dea_schedule");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_compliance_flags_org" ON "compliance_flags" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_risk_scores_org" ON "risk_scores" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_org" ON "audit_logs" USING btree ("organization_id");
