CREATE TYPE "public"."notification_type" AS ENUM('rmp_assignment', 'rmp_message');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"value" jsonb NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "unq_finding_archetypes_catalog_id";--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_org" ON "notifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_org" ON "notifications" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_created" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_finding_archetypes_rule_id" ON "finding_archetypes" USING btree ("rule_id");--> statement-breakpoint
ALTER TABLE "finding_archetypes" DROP COLUMN "serial";--> statement-breakpoint
ALTER TABLE "finding_archetypes" DROP COLUMN "catalog_id";