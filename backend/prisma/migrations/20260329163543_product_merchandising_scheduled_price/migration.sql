-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "merchandisingFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "merchandisingHomeHighlight" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "merchandisingSearchBoost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduledListPriceAmountCents" INTEGER,
ADD COLUMN     "scheduledListPriceCurrency" TEXT,
ADD COLUMN     "scheduledListPriceVariantId" TEXT,
ADD COLUMN     "scheduledPriceEffectiveAt" TIMESTAMP(3),
ADD COLUMN     "scheduledPriceNote" TEXT;
