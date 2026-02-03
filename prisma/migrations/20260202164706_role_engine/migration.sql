-- CreateTable
CREATE TABLE "risk_rules" (
    "id" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_evaluations" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "matchedValue" TEXT,
    "score" INTEGER NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT,

    CONSTRAINT "risk_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_rules_eventName_idx" ON "risk_rules"("eventName");

-- CreateIndex
CREATE INDEX "risk_rules_isActive_idx" ON "risk_rules"("isActive");

-- CreateIndex
CREATE INDEX "risk_evaluations_patientId_idx" ON "risk_evaluations"("patientId");

-- CreateIndex
CREATE INDEX "risk_evaluations_ruleId_idx" ON "risk_evaluations"("ruleId");

-- CreateIndex
CREATE INDEX "risk_evaluations_evaluatedAt_idx" ON "risk_evaluations"("evaluatedAt");

-- CreateIndex
CREATE INDEX "risk_evaluations_eventType_idx" ON "risk_evaluations"("eventType");

-- AddForeignKey
ALTER TABLE "risk_evaluations" ADD CONSTRAINT "risk_evaluations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evaluations" ADD CONSTRAINT "risk_evaluations_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "risk_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
