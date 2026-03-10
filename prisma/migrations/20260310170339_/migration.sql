-- AlterTable
ALTER TABLE "encounters" ADD COLUMN     "allergiesReviewed" BOOLEAN,
ADD COLUMN     "carePlanUpdated" BOOLEAN,
ADD COLUMN     "chiefComplaint" TEXT,
ADD COLUMN     "clinicalDecisionMaker" TEXT,
ADD COLUMN     "clinicalNotesCompleted" TEXT,
ADD COLUMN     "consentObtained" BOOLEAN,
ADD COLUMN     "coordinationWithPcp" BOOLEAN,
ADD COLUMN     "crossStateLicense" BOOLEAN,
ADD COLUMN     "encounterType" TEXT,
ADD COLUMN     "followUpScheduled" BOOLEAN,
ADD COLUMN     "informedConsentType" TEXT,
ADD COLUMN     "isTelehealth" BOOLEAN,
ADD COLUMN     "lengthMinutes" INTEGER,
ADD COLUMN     "mentalHealthScreening" TEXT,
ADD COLUMN     "noteSignedDate" TIMESTAMP(3),
ADD COLUMN     "outcomeMeasured" TEXT,
ADD COLUMN     "partOfId" TEXT,
ADD COLUMN     "patientIdentityVerified" BOOLEAN,
ADD COLUMN     "patientLocation" TEXT,
ADD COLUMN     "patientLocationState" TEXT,
ADD COLUMN     "practitionerName" TEXT,
ADD COLUMN     "priority" TEXT,
ADD COLUMN     "providerLocation" TEXT,
ADD COLUMN     "providerLocationState" TEXT,
ADD COLUMN     "qualityMeasureMet" BOOLEAN,
ADD COLUMN     "serviceProvider" TEXT,
ADD COLUMN     "serviceType" TEXT,
ADD COLUMN     "sessionDurationMinutes" INTEGER,
ADD COLUMN     "sessionEndTime" TIMESTAMP(3),
ADD COLUMN     "sessionRecordingConsent" BOOLEAN,
ADD COLUMN     "sessionStartTime" TIMESTAMP(3),
ADD COLUMN     "stateLicensureVerified" JSONB,
ADD COLUMN     "subjectStatus" TEXT,
ADD COLUMN     "substanceUseScreening" TEXT,
ADD COLUMN     "technologyAssessment" TEXT,
ADD COLUMN     "telehealthId" TEXT,
ADD COLUMN     "vitalSignsRecorded" BOOLEAN;

-- AlterTable
ALTER TABLE "medications" ADD COLUMN     "autoRefillEnabled" BOOLEAN,
ADD COLUMN     "clinicalDecisionSupport" INTEGER,
ADD COLUMN     "controlledSubstancePrescribed" BOOLEAN,
ADD COLUMN     "medicationAdherence" TEXT,
ADD COLUMN     "overrideReason" TEXT,
ADD COLUMN     "prescriptionWritten" BOOLEAN,
ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "refillCount" INTEGER,
ADD COLUMN     "substanceCode" TEXT,
ADD COLUMN     "substanceExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "practitioners" ADD COLUMN     "deaNumber" TEXT;

-- CreateIndex
CREATE INDEX "encounters_partOfId_idx" ON "encounters"("partOfId");

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_partOfId_fkey" FOREIGN KEY ("partOfId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
