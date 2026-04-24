import { apiRequest, ApiError } from "@/lib/api/http";

export type BannerListItem = {
  id: string;
  placement: string;
  status: string;
  sortOrder: number;
  title: string | null;
  mediaUrl: string | null;
  linkUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminBannersListResponse = {
  success: true;
  data: { items: BannerListItem[] };
};

export const listAdminBanners = async (accessToken: string): Promise<AdminBannersListResponse> =>
  apiRequest<AdminBannersListResponse>({
    path: "/api/admin/content/banners",
    accessToken
  });

export type ContentMediaUploadIntentEntity = {
  provider: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  signedFormFields: Record<string, string>;
  uploadUrl: string;
  resourceType: string;
  deliveryType: string;
  publicId: string;
  folder: string;
  allowedFormats: string[];
  maxFileSizeBytes: number;
  signed: boolean;
};

export type CreateContentMediaUploadIntentBody = {
  fileName: string;
  contentType: string;
  fileSizeBytes?: number;
  resourceType?: "image" | "video" | "raw";
};

export const createContentMediaUploadIntent = async (
  accessToken: string,
  body: CreateContentMediaUploadIntentBody
): Promise<{ success: true; data: { entity: ContentMediaUploadIntentEntity } }> =>
  apiRequest({
    method: "POST",
    path: "/api/admin/content/media/upload-intents",
    accessToken,
    body
  });

export type CreateAdminBannerBody = {
  placement: string;
  status?: string;
  sortOrder?: number;
  title?: string;
  mediaUrl?: string;
  mediaStorageProvider?: string;
  mediaPublicId?: string;
  mediaResourceType?: "image" | "video" | "raw";
  mediaDeliveryType?: "upload" | "private";
  mediaMimeType?: string;
  mediaFileSizeBytes?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  mediaDurationSeconds?: number;
  mediaOriginalFilename?: string;
  linkUrl?: string | null;
};

export type UpdateAdminBannerBody = Omit<CreateAdminBannerBody, "placement"> & {
  placement?: string;
  status?: string;
};

export type AdminBannerEntityResponse = {
  success: true;
  data: { entity: BannerListItem };
};

export const createAdminBanner = async (
  accessToken: string,
  body: CreateAdminBannerBody
): Promise<AdminBannerEntityResponse> =>
  apiRequest<AdminBannerEntityResponse>({
    method: "POST",
    path: "/api/admin/content/banners",
    accessToken,
    body
  });

export const updateAdminBanner = async (
  accessToken: string,
  bannerId: string,
  body: UpdateAdminBannerBody
): Promise<AdminBannerEntityResponse> =>
  apiRequest<AdminBannerEntityResponse>({
    method: "PATCH",
    path: `/api/admin/content/banners/${encodeURIComponent(bannerId)}`,
    accessToken,
    body
  });

export const publishAdminBanner = async (
  accessToken: string,
  bannerId: string
): Promise<AdminBannerEntityResponse> =>
  apiRequest<AdminBannerEntityResponse>({
    method: "POST",
    path: `/api/admin/content/banners/${encodeURIComponent(bannerId)}/publish`,
    accessToken,
    body: {}
  });

export const unpublishAdminBanner = async (
  accessToken: string,
  bannerId: string
): Promise<AdminBannerEntityResponse> =>
  apiRequest<AdminBannerEntityResponse>({
    method: "POST",
    path: `/api/admin/content/banners/${encodeURIComponent(bannerId)}/unpublish`,
    accessToken,
    body: {}
  });

export const deleteAdminBanner = async (
  accessToken: string,
  bannerId: string
): Promise<{ success: true; data: { ok: true } }> =>
  apiRequest({
    method: "DELETE",
    path: `/api/admin/content/banners/${encodeURIComponent(bannerId)}`,
    accessToken
  });

export type ContentPageListItem = {
  id: string;
  slug: string;
  title: string | null;
  status: string;
  content?: Record<string, unknown>;
  createdAt?: string;
  updatedAt: string;
};

export type AdminContentPagesListResponse = {
  success: true;
  data: { items: ContentPageListItem[] };
};

export const listAdminContentPages = async (
  accessToken: string
): Promise<AdminContentPagesListResponse> =>
  apiRequest<AdminContentPagesListResponse>({
    path: "/api/admin/content/pages",
    accessToken
  });

export type CmsPageEntity = ContentPageListItem & {
  content: Record<string, unknown>;
  createdAt: string;
};

export type AdminCmsPageDetailResponse = {
  success: true;
  data: { entity: CmsPageEntity };
};

export const getAdminContentPage = async (
  accessToken: string,
  pageId: string
): Promise<AdminCmsPageDetailResponse> =>
  apiRequest<AdminCmsPageDetailResponse>({
    path: `/api/admin/content/pages/${encodeURIComponent(pageId)}`,
    accessToken
  });

export type CreateAdminCmsPageBody = {
  slug: string;
  title?: string;
  status?: string;
  content: Record<string, unknown>;
};

export type UpdateAdminCmsPageBody = {
  title?: string;
  status?: string;
  content?: Record<string, unknown>;
};

export const createAdminContentPage = async (
  accessToken: string,
  body: CreateAdminCmsPageBody
): Promise<AdminCmsPageDetailResponse> =>
  apiRequest<AdminCmsPageDetailResponse>({
    method: "POST",
    path: "/api/admin/content/pages",
    accessToken,
    body
  });

export const updateAdminContentPage = async (
  accessToken: string,
  pageId: string,
  body: UpdateAdminCmsPageBody
): Promise<AdminCmsPageDetailResponse> =>
  apiRequest<AdminCmsPageDetailResponse>({
    method: "PATCH",
    path: `/api/admin/content/pages/${encodeURIComponent(pageId)}`,
    accessToken,
    body
  });

export const publishAdminContentPage = async (
  accessToken: string,
  pageId: string
): Promise<AdminCmsPageDetailResponse> =>
  apiRequest<AdminCmsPageDetailResponse>({
    method: "POST",
    path: `/api/admin/content/pages/${encodeURIComponent(pageId)}/publish`,
    accessToken,
    body: {}
  });

export const unpublishAdminContentPage = async (
  accessToken: string,
  pageId: string
): Promise<AdminCmsPageDetailResponse> =>
  apiRequest<AdminCmsPageDetailResponse>({
    method: "POST",
    path: `/api/admin/content/pages/${encodeURIComponent(pageId)}/unpublish`,
    accessToken,
    body: {}
  });

export const archiveAdminContentPage = async (
  accessToken: string,
  pageId: string
): Promise<AdminCmsPageDetailResponse> =>
  apiRequest<AdminCmsPageDetailResponse>({
    method: "POST",
    path: `/api/admin/content/pages/${encodeURIComponent(pageId)}/archive`,
    accessToken,
    body: {}
  });

export const restoreAdminContentPage = async (
  accessToken: string,
  pageId: string
): Promise<AdminCmsPageDetailResponse> =>
  apiRequest<AdminCmsPageDetailResponse>({
    method: "POST",
    path: `/api/admin/content/pages/${encodeURIComponent(pageId)}/restore`,
    accessToken,
    body: {}
  });

export const deleteAdminContentPagePermanent = async (
  accessToken: string,
  pageId: string
): Promise<{ success: true; data: { ok: true } }> =>
  apiRequest({
    method: "DELETE",
    path: `/api/admin/content/pages/${encodeURIComponent(pageId)}`,
    accessToken
  });

export type HomepageSectionHeader = {
  isVisible: boolean;
  contentMode: "MANUAL" | "AUTO";
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
};

export type HomepageHeroDraft = {
  eyebrow: string;
  titlePrefix: string;
  titleAccent?: string | null;
  titleSuffix?: string | null;
  body: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  backgroundImageUrl: string;
  backgroundImageAlt?: string | null;
};

export type HomepageTrustBadgeDraft = {
  iconName: string;
  title: string;
  subtitle: string;
  href?: string | null;
  ariaLabel?: string | null;
};

export type HomepageCategoryTileDraft = {
  categoryId?: string | null;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
};

export type HomepageFeaturedProductDraft = {
  productId: string;
};

export type HomepageBrandSpotlightDraft = {
  brandId?: string | null;
  slug: string;
  title: string;
  tagline: string;
  heroImageUrl: string;
  ctaLabel: string;
  productIds: string[];
};

export type HomepageCampaignSpotlightDraft = {
  campaignId?: string | null;
  slug: string;
  title: string;
  subtitle: string;
  heroImageUrl: string;
  label: string;
  ctaLabel: string;
  layout: "FEATURE" | "SPLIT";
  productIds: string[];
};

export type HomepagePromoOfferDraft = {
  badge: string;
  code: string;
  headline: string;
  body: string;
  terms: string;
  bannerImageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  productIds: string[];
};

export type HomepageTestimonialDraft = {
  quote: string;
  customerName: string;
  imageUrl: string;
  statusLabel?: string | null;
};

export type AdminHomepageDraftEntity = {
  status: {
    hasPublishedVersion: boolean;
    draftUpdatedAt: string;
    publishedAt: string | null;
  };
  hero: HomepageHeroDraft;
  sectionHeaders: {
    category: HomepageSectionHeader;
    featured: HomepageSectionHeader;
    brand: HomepageSectionHeader;
    campaign: HomepageSectionHeader;
    promo: HomepageSectionHeader;
    testimonial: HomepageSectionHeader;
  };
  trustBadges: HomepageTrustBadgeDraft[];
  categoryTiles: HomepageCategoryTileDraft[];
  featuredProducts: HomepageFeaturedProductDraft[];
  brandSpotlights: HomepageBrandSpotlightDraft[];
  campaignSpotlights: HomepageCampaignSpotlightDraft[];
  promoOffers: HomepagePromoOfferDraft[];
  testimonials: HomepageTestimonialDraft[];
};

export type HomepagePreviewProductCard = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  rating?: number;
  reviewCount?: number;
  description?: string;
  brand?: string;
  defaultVariantId?: string | null;
};

export type AdminHomepageResolvedPreview = {
  hero: {
    eyebrow: string;
    titlePrefix: string;
    titleAccent: string | null;
    titleSuffix: string | null;
    body: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    backgroundImageUrl: string;
    backgroundImageAlt: string;
  };
  trustBadges: Array<{
    iconName: string;
    title: string;
    subtitle: string;
    href: string | null;
    ariaLabel: string | null;
  }>;
  featuredSection: {
    isVisible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    items: HomepagePreviewProductCard[];
  };
  promoSection: {
    isVisible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    items: Array<{
      badge: string;
      code: string;
      headline: string;
      body: string;
      terms: string;
      bannerImageUrl: string;
      ctaLabel: string;
      ctaHref: string;
      products: HomepagePreviewProductCard[];
    }>;
  };
  categorySection: {
    isVisible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    items: Array<{
      slug: string;
      title: string;
      description: string;
      imageUrl: string;
      productCount: number;
      href: string;
    }>;
  };
  brandSection: {
    isVisible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    items: Array<{
      slug: string;
      title: string;
      tagline: string;
      heroImageUrl: string;
      ctaLabel: string;
      href: string;
      products: HomepagePreviewProductCard[];
    }>;
  };
  campaignSection: {
    isVisible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    items: Array<{
      slug: string;
      title: string;
      subtitle: string;
      heroImageUrl: string;
      label: string;
      ctaLabel: string;
      href: string;
      layout: "FEATURE" | "SPLIT";
      products: HomepagePreviewProductCard[];
    }>;
  };
  testimonialSection: {
    isVisible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    items: Array<{
      quote: string;
      customerName: string;
      imageUrl: string;
      statusLabel: string;
    }>;
  };
};

export type HomepageOptionCategory = {
  id: string;
  slug: string;
  name: string;
  productCount: number;
};

export type HomepageOptionProduct = {
  id: string;
  slug: string;
  title: string;
  brandName: string | null;
};

export type HomepageOptionBrand = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

export type HomepageOptionCampaign = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

export type AdminHomepageDraftResponse = {
  success: true;
  data: {
    entity: AdminHomepageDraftEntity;
    resolvedPreview: AdminHomepageResolvedPreview;
    warnings: string[];
    options: {
      categories: HomepageOptionCategory[];
      products: HomepageOptionProduct[];
      brands: HomepageOptionBrand[];
      campaigns: HomepageOptionCampaign[];
    };
  };
};

export type UpdateHomepageDraftBody = Omit<AdminHomepageDraftEntity, "status">;
export type SaveHomepageDraftRequestBody = UpdateHomepageDraftBody & {
  expectedDraftUpdatedAt: string;
};

export const getAdminHomepageDraft = async (
  accessToken: string
): Promise<AdminHomepageDraftResponse> =>
  apiRequest<AdminHomepageDraftResponse>({
    path: "/api/admin/content/homepage",
    accessToken
  });

export const updateAdminHomepageDraft = async (
  accessToken: string,
  body: SaveHomepageDraftRequestBody
): Promise<AdminHomepageDraftResponse> =>
  apiRequest<AdminHomepageDraftResponse>({
    method: "PUT",
    path: "/api/admin/content/homepage",
    accessToken,
    body
  });

export const publishAdminHomepage = async (
  accessToken: string,
  body: SaveHomepageDraftRequestBody
): Promise<AdminHomepageDraftResponse> =>
  apiRequest<AdminHomepageDraftResponse>({
    method: "POST",
    path: "/api/admin/content/homepage/publish",
    accessToken,
    body
  });

export const unpublishAdminHomepage = async (
  accessToken: string
): Promise<AdminHomepageDraftResponse> =>
  apiRequest<AdminHomepageDraftResponse>({
    method: "POST",
    path: "/api/admin/content/homepage/unpublish",
    accessToken,
    body: {}
  });

export { ApiError };
