CREATE TYPE "public"."plan_status" AS ENUM('in_progress', 'pending_validation', 'completed');--> statement-breakpoint
ALTER TABLE "compliance_flags" ADD COLUMN "score_factors_override" jsonb;--> statement-breakpoint
ALTER TABLE "compliance_flags" ADD COLUMN "risk_score" real DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "risk_management_plans" ADD COLUMN "status" "plan_status" DEFAULT 'in_progress' NOT NULL;