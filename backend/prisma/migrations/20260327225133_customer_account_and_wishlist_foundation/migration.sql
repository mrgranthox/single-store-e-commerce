-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actorUserId" TEXT;

-- AlterTable
ALTER TABLE "TimelineEvent" ADD COLUMN     "actorUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneNumber" TEXT;

-- CreateTable
CREATE TABLE "UserAddress" (
    "id" TEXT NOT NULL,
    "storeId" TEXT,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "deliveryInstructions" TEXT,
    "isDefaultShipping" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultBilling" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotificationPreference" (
    "id" TEXT NOT NULL,
    "storeId" TEXT,
    "userId" TEXT NOT NULL,
    "orderUpdatesEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "shipmentUpdatesEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "supportUpdatesEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reviewRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "securityAlertsEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "marketingEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "marketingSmsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "selectionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAddress_userId_createdAt_idx" ON "UserAddress"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationPreference_userId_key" ON "UserNotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "WishlistItem_userId_createdAt_idx" ON "WishlistItem"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");

-- CreateIndex
CREATE INDEX "WishlistItem_variantId_idx" ON "WishlistItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_userId_selectionKey_key" ON "WishlistItem"("userId", "selectionKey");

-- AddForeignKey
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
