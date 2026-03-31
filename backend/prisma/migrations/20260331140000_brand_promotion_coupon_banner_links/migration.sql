-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "bannerId" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "galleryImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "bannerId" TEXT;

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "bannerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Brand_bannerId_key" ON "Brand"("bannerId");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
