CREATE TABLE "raw_fhir_ingestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"source_record_key" text,
	"raw_payload_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raw_fhir_ingestions" ADD CONSTRAINT "raw_fhir_ingestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_fhir_ingestions" ADD CONSTRAINT "raw_fhir_ingestions_job_id_ingestion_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ingestion_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unq_org_job_raw_row" ON "raw_fhir_ingestions" USING btree ("organization_id","job_id","row_number");