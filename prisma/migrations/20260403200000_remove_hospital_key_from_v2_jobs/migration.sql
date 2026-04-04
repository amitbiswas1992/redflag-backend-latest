-- Remove hospitalKey field and its index from ingestion_jobs_v2 (single-tenant design)
DROP INDEX "ingestion_jobs_v2_sourceType_hospitalKey_idx";
ALTER TABLE ingestion_jobs_v2 DROP COLUMN "hospitalKey";
