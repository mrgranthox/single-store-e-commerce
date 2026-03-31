-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "mediaDeliveryType" TEXT NOT NULL DEFAULT 'upload',
ADD COLUMN     "mediaDurationSeconds" DOUBLE PRECISION,
ADD COLUMN     "mediaFileSizeBytes" INTEGER,
ADD COLUMN     "mediaHeight" INTEGER,
ADD COLUMN     "mediaMimeType" TEXT,
ADD COLUMN     "mediaOriginalFilename" TEXT,
ADD COLUMN     "mediaPublicId" TEXT,
ADD COLUMN     "mediaResourceType" TEXT,
ADD COLUMN     "mediaStorageProvider" TEXT,
ADD COLUMN     "mediaWidth" INTEGER;

-- AlterTable
ALTER TABLE "ProductMedia" ADD COLUMN     "deliveryType" TEXT NOT NULL DEFAULT 'upload',
ADD COLUMN     "durationSeconds" DOUBLE PRECISION,
ADD COLUMN     "fileSizeBytes" INTEGER,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "originalFilename" TEXT,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "resourceType" TEXT,
ADD COLUMN     "storageProvider" TEXT NOT NULL DEFAULT 'cloudinary',
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "SupportAttachment" ADD COLUMN     "deliveryType" TEXT NOT NULL DEFAULT 'private',
ADD COLUMN     "durationSeconds" DOUBLE PRECISION,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "originalFilename" TEXT,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "resourceType" TEXT,
ADD COLUMN     "storageProvider" TEXT NOT NULL DEFAULT 'cloudinary',
ADD COLUMN     "width" INTEGER;
