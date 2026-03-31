-- CreateTable
CREATE TABLE "InventoryOverviewSnapshot" (
    "id" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trackedLineCount" INTEGER NOT NULL,
    "healthyStockCount" INTEGER NOT NULL,
    "lowStockCount" INTEGER NOT NULL,
    "outOfStockCount" INTEGER NOT NULL,
    "inTransitValueCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryOverviewSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryOverviewSnapshot_capturedAt_idx" ON "InventoryOverviewSnapshot"("capturedAt");
