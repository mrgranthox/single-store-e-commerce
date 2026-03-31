ALTER TABLE "SessionMetadata"
ADD COLUMN "ipAddress" TEXT;

ALTER TABLE "LoginEvent"
ADD COLUMN "ipAddress" TEXT;
