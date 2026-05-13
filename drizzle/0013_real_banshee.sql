CREATE TYPE "public"."risk_management_plan_type" AS ENUM('mitigate', 'accept', 'risk-transfer');--> statement-breakpoint
CREATE TABLE "auth_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"event_type" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "functional_role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"functional_role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "functional_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "functional_roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organization_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"platform_role" text DEFAULT 'MEMBER' NOT NULL,
	"functional_role_id" uuid NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"token_jti" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_invites_token_jti_unique" UNIQUE("token_jti")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "functional_role_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "risk_management_plans" ADD COLUMN "type" "risk_management_plan_type" DEFAULT 'mitigate' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_role_permissions" ADD CONSTRAINT "functional_role_permissions_functional_role_id_functional_roles_id_fk" FOREIGN KEY ("functional_role_id") REFERENCES "public"."functional_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_role_permissions" ADD CONSTRAINT "functional_role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_functional_role_id_functional_roles_id_fk" FOREIGN KEY ("functional_role_id") REFERENCES "public"."functional_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auth_events_user" ON "auth_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_events_org" ON "auth_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_auth_events_type" ON "auth_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_auth_events_created" ON "auth_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_func_role_permission" ON "functional_role_permissions" USING btree ("functional_role_id","permission_id");--> statement-breakpoint
CREATE INDEX "idx_invites_org" ON "organization_invites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invites_email" ON "organization_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_invites_token" ON "organization_invites" USING btree ("token_jti");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_invite_org_email" ON "organization_invites" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_permission_resource_action" ON "permissions" USING btree ("resource","action");--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_functional_role_id_functional_roles_id_fk" FOREIGN KEY ("functional_role_id") REFERENCES "public"."functional_roles"("id") ON DELETE cascade ON UPDATE no action;