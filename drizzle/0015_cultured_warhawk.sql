ALTER TABLE "compliance_flags" DROP CONSTRAINT "unq_compliance_flags_instance_id";--> statement-breakpoint
DROP INDEX "unq_finding_archetypes_catalog_id";--> statement-breakpoint
DROP INDEX "unq_risk_rules_category_serial";--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "score_tuning" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "unq_compliance_flags_instance_id" ON "compliance_flags" USING btree ("organization_id","instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_finding_archetypes_catalog_id" ON "finding_archetypes" USING btree ("organization_id","catalog_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_risk_rules_category_serial" ON "risk_rules" USING btree ("organization_id","category_id","serial");