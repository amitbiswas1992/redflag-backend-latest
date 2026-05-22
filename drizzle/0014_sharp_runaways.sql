CREATE TABLE "finding_archetypes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"rule_id" uuid,
	"description" text,
	"severity_rationale" text,
	"applicable_theories" jsonb,
	"parent_id" uuid,
	"serial" integer,
	"catalog_id" text,
	"score_factors" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_flags" ADD COLUMN "serial" integer;--> statement-breakpoint
ALTER TABLE "compliance_flags" ADD COLUMN "instance_id" text;--> statement-breakpoint
ALTER TABLE "risk_rules" ADD COLUMN "serial" integer;--> statement-breakpoint
ALTER TABLE "rule_categories" ADD COLUMN "prefix" text NOT NULL;--> statement-breakpoint
ALTER TABLE "finding_archetypes" ADD CONSTRAINT "finding_archetypes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_archetypes" ADD CONSTRAINT "finding_archetypes_rule_id_risk_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."risk_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_finding_archetypes_org" ON "finding_archetypes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_finding_archetypes_rule" ON "finding_archetypes" USING btree ("organization_id","rule_id");--> statement-breakpoint
CREATE INDEX "idx_finding_archetypes_parent" ON "finding_archetypes" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_finding_archetypes_catalog_id" ON "finding_archetypes" USING btree ("catalog_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_risk_rules_category_serial" ON "risk_rules" USING btree ("category_id","serial");--> statement-breakpoint
ALTER TABLE "compliance_flags" ADD CONSTRAINT "unq_compliance_flags_instance_id" UNIQUE("instance_id");--> statement-breakpoint
ALTER TABLE "risk_management_plan_compliance_flags" ADD CONSTRAINT "unq_rmp_compliance_flags_flag" UNIQUE("compliance_flag_id");