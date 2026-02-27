-- AlterTable
ALTER TABLE "allergies" ALTER COLUMN "allergen" DROP NOT NULL,
ALTER COLUMN "type" DROP NOT NULL;

-- AlterTable
ALTER TABLE "conditions" ALTER COLUMN "diagnosis" DROP NOT NULL,
ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "diagnostic_reports" ALTER COLUMN "reportName" DROP NOT NULL,
ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "encounters" ALTER COLUMN "visitType" DROP NOT NULL,
ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "medications" ALTER COLUMN "medication" DROP NOT NULL,
ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "observations" ALTER COLUMN "testName" DROP NOT NULL,
ALTER COLUMN "value" DROP NOT NULL,
ALTER COLUMN "date" DROP NOT NULL,
ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "procedures" ALTER COLUMN "procedure" DROP NOT NULL,
ALTER COLUMN "status" DROP NOT NULL;
