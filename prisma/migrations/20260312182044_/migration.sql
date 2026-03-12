-- CreateTable
CREATE TABLE "ingestion_stats" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "patients" INTEGER NOT NULL DEFAULT 0,
    "observations" INTEGER NOT NULL DEFAULT 0,
    "conditions" INTEGER NOT NULL DEFAULT 0,
    "allergies" INTEGER NOT NULL DEFAULT 0,
    "medications" INTEGER NOT NULL DEFAULT 0,
    "procedures" INTEGER NOT NULL DEFAULT 0,
    "encounters" INTEGER NOT NULL DEFAULT 0,
    "diagnosticReports" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingestion_stats_date_idx" ON "ingestion_stats"("date");
