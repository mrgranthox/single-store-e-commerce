-- CreateEnum
CREATE TYPE "HomePageVersionState" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "HomePageSectionHeaderKind" AS ENUM ('CATEGORY', 'FEATURED', 'BRAND', 'CAMPAIGN', 'PROMO', 'TESTIMONIAL');

-- CreateEnum
CREATE TYPE "HomePageCampaignLayout" AS ENUM ('FEATURE', 'SPLIT');

-- CreateTable
CREATE TABLE "HomePageVersion" (
    "id" TEXT NOT NULL,
    "storeId" TEXT,
    "state" "HomePageVersionState" NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePageHero" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "eyebrow" TEXT NOT NULL,
    "titlePrefix" TEXT NOT NULL,
    "titleAccent" TEXT,
    "titleSuffix" TEXT,
    "body" TEXT NOT NULL,
    "primaryCtaLabel" TEXT NOT NULL,
    "primaryCtaHref" TEXT NOT NULL,
    "backgroundImageUrl" TEXT NOT NULL,
    "backgroundImageAlt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePageHero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePageSectionHeader" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "kind" "HomePageSectionHeaderKind" NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "eyebrow" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePageSectionHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePageTrustBadge" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "iconName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "href" TEXT,
    "ariaLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePageTrustBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePageCategoryTile" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "categoryId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePageCategoryTile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePageFeaturedProduct" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePageFeaturedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePageBrandSpotlight" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "brandId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "heroImageUrl" TEXT NOT NULL,
    "ctaLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePageBrandSpotlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePageBrandSpotlightProduct" (
    "id" TEXT NOT NULL,
    "brandSpotlightId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomePageBrandSpotlightProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePageCampaignSpotlight" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "campaignId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "heroImageUrl" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ctaLabel" TEXT NOT NULL,
    "layout" "HomePageCampaignLayout" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePageCampaignSpotlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePageCampaignSpotlightProduct" (
    "id" TEXT NOT NULL,
    "campaignSpotlightId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomePageCampaignSpotlightProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePagePromoOffer" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "badge" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "terms" TEXT NOT NULL,
    "bannerImageUrl" TEXT NOT NULL,
    "ctaLabel" TEXT NOT NULL,
    "ctaHref" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePagePromoOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePagePromoOfferProduct" (
    "id" TEXT NOT NULL,
    "promoOfferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomePagePromoOfferProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePageTestimonial" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "quote" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "statusLabel" TEXT NOT NULL DEFAULT 'Verified purchase',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePageTestimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomePageVersion_state_key" ON "HomePageVersion"("state");

-- CreateIndex
CREATE UNIQUE INDEX "HomePageHero_versionId_key" ON "HomePageHero"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "HomePageSectionHeader_versionId_kind_key" ON "HomePageSectionHeader"("versionId", "kind");

-- CreateIndex
CREATE INDEX "HomePageTrustBadge_versionId_sortOrder_idx" ON "HomePageTrustBadge"("versionId", "sortOrder");

-- CreateIndex
CREATE INDEX "HomePageCategoryTile_versionId_sortOrder_idx" ON "HomePageCategoryTile"("versionId", "sortOrder");

-- CreateIndex
CREATE INDEX "HomePageFeaturedProduct_versionId_sortOrder_idx" ON "HomePageFeaturedProduct"("versionId", "sortOrder");

-- CreateIndex
CREATE INDEX "HomePageBrandSpotlight_versionId_sortOrder_idx" ON "HomePageBrandSpotlight"("versionId", "sortOrder");

-- CreateIndex
CREATE INDEX "HomePageBrandSpotlightProduct_brandSpotlightId_sortOrder_idx" ON "HomePageBrandSpotlightProduct"("brandSpotlightId", "sortOrder");

-- CreateIndex
CREATE INDEX "HomePageCampaignSpotlight_versionId_sortOrder_idx" ON "HomePageCampaignSpotlight"("versionId", "sortOrder");

-- CreateIndex
CREATE INDEX "HomePageCampaignSpotlightProduct_campaignSpotlightId_sortOr_idx" ON "HomePageCampaignSpotlightProduct"("campaignSpotlightId", "sortOrder");

-- CreateIndex
CREATE INDEX "HomePagePromoOffer_versionId_sortOrder_idx" ON "HomePagePromoOffer"("versionId", "sortOrder");

-- CreateIndex
CREATE INDEX "HomePagePromoOfferProduct_promoOfferId_sortOrder_idx" ON "HomePagePromoOfferProduct"("promoOfferId", "sortOrder");

-- CreateIndex
CREATE INDEX "HomePageTestimonial_versionId_sortOrder_idx" ON "HomePageTestimonial"("versionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "HomePageHero" ADD CONSTRAINT "HomePageHero_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "HomePageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageSectionHeader" ADD CONSTRAINT "HomePageSectionHeader_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "HomePageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageTrustBadge" ADD CONSTRAINT "HomePageTrustBadge_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "HomePageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageCategoryTile" ADD CONSTRAINT "HomePageCategoryTile_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "HomePageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageCategoryTile" ADD CONSTRAINT "HomePageCategoryTile_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageFeaturedProduct" ADD CONSTRAINT "HomePageFeaturedProduct_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "HomePageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageFeaturedProduct" ADD CONSTRAINT "HomePageFeaturedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageBrandSpotlight" ADD CONSTRAINT "HomePageBrandSpotlight_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "HomePageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageBrandSpotlight" ADD CONSTRAINT "HomePageBrandSpotlight_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageBrandSpotlightProduct" ADD CONSTRAINT "HomePageBrandSpotlightProduct_brandSpotlightId_fkey" FOREIGN KEY ("brandSpotlightId") REFERENCES "HomePageBrandSpotlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageBrandSpotlightProduct" ADD CONSTRAINT "HomePageBrandSpotlightProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageCampaignSpotlight" ADD CONSTRAINT "HomePageCampaignSpotlight_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "HomePageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageCampaignSpotlight" ADD CONSTRAINT "HomePageCampaignSpotlight_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageCampaignSpotlightProduct" ADD CONSTRAINT "HomePageCampaignSpotlightProduct_campaignSpotlightId_fkey" FOREIGN KEY ("campaignSpotlightId") REFERENCES "HomePageCampaignSpotlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageCampaignSpotlightProduct" ADD CONSTRAINT "HomePageCampaignSpotlightProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePagePromoOffer" ADD CONSTRAINT "HomePagePromoOffer_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "HomePageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePagePromoOfferProduct" ADD CONSTRAINT "HomePagePromoOfferProduct_promoOfferId_fkey" FOREIGN KEY ("promoOfferId") REFERENCES "HomePagePromoOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePagePromoOfferProduct" ADD CONSTRAINT "HomePagePromoOfferProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePageTestimonial" ADD CONSTRAINT "HomePageTestimonial_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "HomePageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
