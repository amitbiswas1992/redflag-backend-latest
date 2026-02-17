-- AlterTable
ALTER TABLE "risk_rules" ADD COLUMN     "affectedVariables" TEXT[],
ADD COLUMN     "conditionLogic" TEXT NOT NULL DEFAULT 'AND',
ADD COLUMN     "redFlags" TEXT[],
ADD COLUMN     "regulatoryCitation" TEXT,
ADD COLUMN     "ruleCode" TEXT,
ADD COLUMN     "taxonomy" TEXT,
ALTER COLUMN "eventName" DROP NOT NULL,
ALTER COLUMN "field" DROP NOT NULL,
ALTER COLUMN "operator" DROP NOT NULL,
ALTER COLUMN "value" DROP NOT NULL;

-- CreateTable
CREATE TABLE "rule_conditions" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rule_conditions_ruleId_idx" ON "rule_conditions"("ruleId");

-- CreateIndex
CREATE INDEX "rule_conditions_ruleId_order_idx" ON "rule_conditions"("ruleId", "order");

-- CreateIndex
CREATE INDEX "risk_rules_ruleCode_idx" ON "risk_rules"("ruleCode");

-- AddForeignKey
ALTER TABLE "rule_conditions" ADD CONSTRAINT "rule_conditions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "risk_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
