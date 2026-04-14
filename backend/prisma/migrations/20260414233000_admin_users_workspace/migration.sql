CREATE TYPE "AdminInvitationStatus" AS ENUM ('PENDING', 'REVOKED', 'ACCEPTED', 'EXPIRED');

ALTER TABLE "AdminUser"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

CREATE TABLE "AdminInvitation" (
    "id" TEXT NOT NULL,
    "storeId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "status" "AdminInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "note" TEXT,
    "invitedByAdminUserId" TEXT NOT NULL,
    "revokedByAdminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminInvitationRole" (
    "invitationId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInvitationRole_pkey" PRIMARY KEY ("invitationId","roleId")
);

CREATE UNIQUE INDEX "AdminInvitation_tokenHash_key" ON "AdminInvitation"("tokenHash");
CREATE UNIQUE INDEX "AdminInvitation_email_status_key" ON "AdminInvitation"("email", "status");
CREATE INDEX "AdminInvitation_status_createdAt_idx" ON "AdminInvitation"("status", "createdAt");

ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_invitedByAdminUserId_fkey"
FOREIGN KEY ("invitedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_revokedByAdminUserId_fkey"
FOREIGN KEY ("revokedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminInvitationRole" ADD CONSTRAINT "AdminInvitationRole_invitationId_fkey"
FOREIGN KEY ("invitationId") REFERENCES "AdminInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminInvitationRole" ADD CONSTRAINT "AdminInvitationRole_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
