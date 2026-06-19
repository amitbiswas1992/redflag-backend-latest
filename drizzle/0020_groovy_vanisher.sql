CREATE TYPE "public"."update_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'rmp_update_request';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'rmp_update_reviewed';--> statement-breakpoint
CREATE TABLE "risk_management_plan_update_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"risk_management_plan_id" uuid NOT NULL,
	"requested_by" uuid,
	"reviewed_by" uuid,
	"status" "update_request_status" DEFAULT 'pending' NOT NULL,
	"proposed_changes" jsonb NOT NULL,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "risk_management_plan_update_requests" ADD CONSTRAINT "risk_management_plan_update_requests_risk_management_plan_id_risk_management_plans_id_fk" FOREIGN KEY ("risk_management_plan_id") REFERENCES "public"."risk_management_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_management_plan_update_requests" ADD CONSTRAINT "risk_management_plan_update_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_management_plan_update_requests" ADD CONSTRAINT "risk_management_plan_update_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rmp_update_requests_plan" ON "risk_management_plan_update_requests" USING btree ("risk_management_plan_id");--> statement-breakpoint
CREATE INDEX "idx_rmp_update_requests_requester" ON "risk_management_plan_update_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "idx_rmp_update_requests_reviewer" ON "risk_management_plan_update_requests" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX "idx_rmp_update_requests_status" ON "risk_management_plan_update_requests" USING btree ("status");