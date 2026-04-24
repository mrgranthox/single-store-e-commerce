-- CreateEnum
CREATE TYPE "HomePageContentMode" AS ENUM ('MANUAL', 'AUTO');

-- AlterTable
ALTER TABLE "HomePageSectionHeader"
ADD COLUMN "contentMode" "HomePageContentMode" NOT NULL DEFAULT 'MANUAL';

-- Backfill
UPDATE "HomePageSectionHeader"
SET "contentMode" = CASE
  WHEN "kind" IN ('CATEGORY', 'FEATURED', 'BRAND', 'CAMPAIGN') THEN 'AUTO'::"HomePageContentMode"
  ELSE 'MANUAL'::"HomePageContentMode"
END;
