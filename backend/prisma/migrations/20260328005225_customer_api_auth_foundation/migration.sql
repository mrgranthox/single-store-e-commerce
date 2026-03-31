-- CreateTable
CREATE TABLE "CustomerApiSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerApiSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAuthChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerApiSession_sessionId_key" ON "CustomerApiSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerApiSession_accessTokenHash_key" ON "CustomerApiSession"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerApiSession_refreshTokenHash_key" ON "CustomerApiSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "CustomerApiSession_userId_revokedAt_idx" ON "CustomerApiSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "CustomerApiSession_accessTokenExpiresAt_idx" ON "CustomerApiSession"("accessTokenExpiresAt");

-- CreateIndex
CREATE INDEX "CustomerApiSession_refreshTokenExpiresAt_idx" ON "CustomerApiSession"("refreshTokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAuthChallenge_tokenHash_key" ON "CustomerAuthChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerAuthChallenge_userId_purpose_consumedAt_expiresAt_idx" ON "CustomerAuthChallenge"("userId", "purpose", "consumedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "CustomerApiSession" ADD CONSTRAINT "CustomerApiSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAuthChallenge" ADD CONSTRAINT "CustomerAuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
