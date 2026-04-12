CREATE TABLE IF NOT EXISTS "raw_fhir_ingestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"source_record_key" text,
	"raw_payload_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "raw_fhir_ingestions_organization_id_organizations_id_fk"
		FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade,
	CONSTRAINT "raw_fhir_ingestions_job_id_ingestion_jobs_id_fk"
		FOREIGN KEY ("job_id") REFERENCES "ingestion_jobs"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unq_org_job_raw_row"
	ON "raw_fhir_ingestions" ("organization_id", "job_id", "row_number");
