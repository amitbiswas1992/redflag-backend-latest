CREATE TABLE IF NOT EXISTS "substances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"encounter_id" uuid,
	"status" text,
	"code" text,
	"code_display" text,
	"category" text,
	"instance" text,
	"quantity_value" text,
	"quantity_unit" text,
	"expiry" timestamp,
	"description" text,
	"extension" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "substances_organization_id_organizations_id_fk"
		FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade,
	CONSTRAINT "substances_patient_id_patients_id_fk"
		FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE cascade,
	CONSTRAINT "substances_encounter_id_encounters_id_fk"
		FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unq_source_org_substance"
	ON "substances" ("organization_id", "source_id");