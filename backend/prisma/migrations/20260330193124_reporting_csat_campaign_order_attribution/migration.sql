-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "costCents" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "campaignId" TEXT;

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "csatScore" INTEGER,
ADD COLUMN     "csatSubmittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_campaignId_idx" ON "Order"("campaignId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
