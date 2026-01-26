-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "epicId" TEXT NOT NULL,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "age" TEXT,
    "dateOfBirth" TEXT,
    "identifiers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioners" (
    "id" TEXT NOT NULL,
    "epicId" TEXT NOT NULL,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "prefix" TEXT[],
    "suffix" TEXT[],
    "gender" TEXT,
    "birthDate" TIMESTAMP(3),
    "identifiers" JSONB,
    "telecom" JSONB,
    "address" JSONB,
    "qualifications" JSONB,
    "languages" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practitioners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" TEXT NOT NULL,
    "epicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "code" TEXT,
    "display" TEXT,
    "category" TEXT,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditions" (
    "id" TEXT NOT NULL,
    "epicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "onsetDate" TIMESTAMP(3),
    "recordedDate" TIMESTAMP(3),
    "code" TEXT,
    "display" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allergies" (
    "id" TEXT NOT NULL,
    "epicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "allergen" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT,
    "status" TEXT NOT NULL,
    "recordedDate" TIMESTAMP(3),
    "code" TEXT,
    "display" TEXT,
    "category" TEXT[],
    "criticality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medications" (
    "id" TEXT NOT NULL,
    "epicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medication" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dosage" TEXT,
    "route" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "dateAsserted" TIMESTAMP(3),
    "code" TEXT,
    "display" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedures" (
    "id" TEXT NOT NULL,
    "epicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "outcome" TEXT,
    "code" TEXT,
    "display" TEXT,
    "category" TEXT,
    "performedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" TEXT NOT NULL,
    "epicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitType" TEXT NOT NULL,
    "reason" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "type" TEXT,
    "class" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_reports" (
    "id" TEXT NOT NULL,
    "epicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "reportName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "conclusion" TEXT,
    "code" TEXT,
    "display" TEXT,
    "category" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "issuedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patients_epicId_key" ON "patients"("epicId");

-- CreateIndex
CREATE INDEX "patients_epicId_idx" ON "patients"("epicId");

-- CreateIndex
CREATE UNIQUE INDEX "practitioners_epicId_key" ON "practitioners"("epicId");

-- CreateIndex
CREATE INDEX "practitioners_epicId_idx" ON "practitioners"("epicId");

-- CreateIndex
CREATE UNIQUE INDEX "observations_epicId_key" ON "observations"("epicId");

-- CreateIndex
CREATE INDEX "observations_patientId_idx" ON "observations"("patientId");

-- CreateIndex
CREATE INDEX "observations_epicId_idx" ON "observations"("epicId");

-- CreateIndex
CREATE UNIQUE INDEX "conditions_epicId_key" ON "conditions"("epicId");

-- CreateIndex
CREATE INDEX "conditions_patientId_idx" ON "conditions"("patientId");

-- CreateIndex
CREATE INDEX "conditions_epicId_idx" ON "conditions"("epicId");

-- CreateIndex
CREATE UNIQUE INDEX "allergies_epicId_key" ON "allergies"("epicId");

-- CreateIndex
CREATE INDEX "allergies_patientId_idx" ON "allergies"("patientId");

-- CreateIndex
CREATE INDEX "allergies_epicId_idx" ON "allergies"("epicId");

-- CreateIndex
CREATE UNIQUE INDEX "medications_epicId_key" ON "medications"("epicId");

-- CreateIndex
CREATE INDEX "medications_patientId_idx" ON "medications"("patientId");

-- CreateIndex
CREATE INDEX "medications_epicId_idx" ON "medications"("epicId");

-- CreateIndex
CREATE UNIQUE INDEX "procedures_epicId_key" ON "procedures"("epicId");

-- CreateIndex
CREATE INDEX "procedures_patientId_idx" ON "procedures"("patientId");

-- CreateIndex
CREATE INDEX "procedures_epicId_idx" ON "procedures"("epicId");

-- CreateIndex
CREATE UNIQUE INDEX "encounters_epicId_key" ON "encounters"("epicId");

-- CreateIndex
CREATE INDEX "encounters_patientId_idx" ON "encounters"("patientId");

-- CreateIndex
CREATE INDEX "encounters_epicId_idx" ON "encounters"("epicId");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_reports_epicId_key" ON "diagnostic_reports"("epicId");

-- CreateIndex
CREATE INDEX "diagnostic_reports_patientId_idx" ON "diagnostic_reports"("patientId");

-- CreateIndex
CREATE INDEX "diagnostic_reports_epicId_idx" ON "diagnostic_reports"("epicId");

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
