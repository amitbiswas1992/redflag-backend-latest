CREATE TABLE "rule_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "risk_evaluations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "risk_evaluations" CASCADE;--> statement-breakpoint
ALTER TABLE "compliance_flags" ADD COLUMN "rule_id" uuid;--> statement-breakpoint
ALTER TABLE "compliance_flags" ADD COLUMN "violation_context" jsonb;--> statement-breakpoint
ALTER TABLE "risk_rules" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "risk_rules" ADD COLUMN "rule_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "risk_rules" ADD COLUMN "target_table" text NOT NULL;--> statement-breakpoint
ALTER TABLE "risk_rules" ADD COLUMN "severity" text NOT NULL;--> statement-breakpoint
ALTER TABLE "rule_conditions" ADD COLUMN "field_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "rule_conditions" ADD COLUMN "logical_operator" text DEFAULT 'AND' NOT NULL;--> statement-breakpoint
ALTER TABLE "rule_categories" ADD CONSTRAINT "rule_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rule_categories_org" ON "rule_categories" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "compliance_flags" ADD CONSTRAINT "compliance_flags_rule_id_risk_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."risk_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_rules" ADD CONSTRAINT "risk_rules_category_id_rule_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."rule_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_compliance_flags_rule" ON "compliance_flags" USING btree ("organization_id","rule_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_flags_entity" ON "compliance_flags" USING btree ("organization_id","entity_id");--> statement-breakpoint
CREATE INDEX "idx_risk_rules_org_active" ON "risk_rules" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_risk_rules_category" ON "risk_rules" USING btree ("organization_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_rule_conditions_rule" ON "rule_conditions" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_rule_conditions_org" ON "rule_conditions" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "risk_rules" DROP COLUMN "role_name";--> statement-breakpoint
ALTER TABLE "risk_rules" DROP COLUMN "risk_level";--> statement-breakpoint
ALTER TABLE "risk_rules" DROP COLUMN "event_name";--> statement-breakpoint
ALTER TABLE "risk_rules" DROP COLUMN "score";--> statement-breakpoint
ALTER TABLE "risk_rules" DROP COLUMN "condition_logic";--> statement-breakpoint
ALTER TABLE "risk_rules" DROP COLUMN "affected_variables";--> statement-breakpoint
ALTER TABLE "risk_rules" DROP COLUMN "taxonomy";--> statement-breakpoint
ALTER TABLE "risk_rules" DROP COLUMN "regulatory_citation";--> statement-breakpoint
ALTER TABLE "risk_rules" DROP COLUMN "red_flags";--> statement-breakpoint
ALTER TABLE "rule_conditions" DROP COLUMN "field";