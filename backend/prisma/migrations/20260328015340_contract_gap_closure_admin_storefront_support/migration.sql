-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "productSlugSnapshot" TEXT,
ADD COLUMN     "productTitleSnapshot" TEXT,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "supportType" TEXT NOT NULL DEFAULT 'GENERAL';
