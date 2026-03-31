-- CreateTable
CREATE TABLE "AdminApiSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminApiSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuthChallenge" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminApiSession_sessionId_key" ON "AdminApiSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminApiSession_accessTokenHash_key" ON "AdminApiSession"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AdminApiSession_refreshTokenHash_key" ON "AdminApiSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AdminApiSession_adminUserId_revokedAt_idx" ON "AdminApiSession"("adminUserId", "revokedAt");

-- CreateIndex
CREATE INDEX "AdminApiSession_accessTokenExpiresAt_idx" ON "AdminApiSession"("accessTokenExpiresAt");

-- CreateIndex
CREATE INDEX "AdminApiSession_refreshTokenExpiresAt_idx" ON "AdminApiSession"("refreshTokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAuthChallenge_tokenHash_key" ON "AdminAuthChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminAuthChallenge_adminUserId_purpose_consumedAt_expiresAt_idx" ON "AdminAuthChallenge"("adminUserId", "purpose", "consumedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "AdminApiSession" ADD CONSTRAINT "AdminApiSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuthChallenge" ADD CONSTRAINT "AdminAuthChallenge_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
