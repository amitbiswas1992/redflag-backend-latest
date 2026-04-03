-- CreateEnum
CREATE TYPE "IngestionJobStatusV2" AS ENUM ('CREATED', 'UPLOADED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestionRowOutcomeV2" AS ENUM ('INSERTED', 'UPDATED', 'SKIPPED', 'ERROR');

-- CreateTable
CREATE TABLE "ingestion_jobs_v2" (
  "id" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "hospitalKey" TEXT NOT NULL,
  "templateVersion" TEXT,
  "status" "IngestionJobStatusV2" NOT NULL DEFAULT 'CREATED',
  "checksumSha256" TEXT,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "processedRows" INTEGER NOT NULL DEFAULT 0,
  "successRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "mappingManifest" JSONB,
  "errorSummary" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ingestion_jobs_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_row_results_v2" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "sourceRecordKey" TEXT,
  "entityType" TEXT,
  "outcome" "IngestionRowOutcomeV2" NOT NULL,
  "reasonCode" TEXT,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ingestion_row_results_v2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingestion_jobs_v2_status_idx" ON "ingestion_jobs_v2"("status");

-- CreateIndex
CREATE INDEX "ingestion_jobs_v2_sourceType_hospitalKey_idx" ON "ingestion_jobs_v2"("sourceType", "hospitalKey");

-- CreateIndex
CREATE INDEX "ingestion_jobs_v2_createdAt_idx" ON "ingestion_jobs_v2"("createdAt");

-- CreateIndex
CREATE INDEX "ingestion_row_results_v2_jobId_idx" ON "ingestion_row_results_v2"("jobId");

-- CreateIndex
CREATE INDEX "ingestion_row_results_v2_jobId_rowNumber_idx" ON "ingestion_row_results_v2"("jobId", "rowNumber");

-- CreateIndex
CREATE INDEX "ingestion_row_results_v2_outcome_idx" ON "ingestion_row_results_v2"("outcome");

-- AddForeignKey
ALTER TABLE "ingestion_row_results_v2"
ADD CONSTRAINT "ingestion_row_results_v2_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "ingestion_jobs_v2"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
