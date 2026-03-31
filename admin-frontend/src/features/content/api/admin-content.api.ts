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

export { ApiError };
