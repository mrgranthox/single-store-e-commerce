-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaTitle" TEXT,
ADD COLUMN     "richDescription" TEXT,
ADD COLUMN     "scheduledPublishAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "costAmountCents" INTEGER;
