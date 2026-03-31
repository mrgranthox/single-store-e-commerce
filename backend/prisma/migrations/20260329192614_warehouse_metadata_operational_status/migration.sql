-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "operationalStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
