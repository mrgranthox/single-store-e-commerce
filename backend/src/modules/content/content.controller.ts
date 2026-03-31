import { z } from "zod";

import { requireAdminUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
import {
  bannerIdParamsSchema,
  contentMutationBodySchema,
  contentMediaUploadIntentBodySchema,
  createBannerBodySchema,
  createPageBodySchema,
  pageIdParamsSchema,
  pageSlugParamsSchema,
  publicBannersQuerySchema,
  updateBannerBodySchema,
  updatePageBodySchema
} from "./content.schemas";
import {
  archiveAdminPage,
  createAdminBanner,
  createAdminContentMediaUploadIntent,
  createAdminPage,
  deleteAdminBanner,
  deleteAdminPagePermanent,
  getAdminPage,
  getPublicContentPage,
  listAdminBanners,
  listAdminPages,
  listPublicBanners,
  publishAdminBanner,
  publishAdminPage,
  restoreAdminPage,
  unpublishAdminBanner,
  unpublishAdminPage,
  updateAdminBanner,
  updateAdminPage
} from "./content.service";

export const getPagePublic = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof pageSlugParamsSchema>>(request);
  const data = await getPublicContentPage(params.slug);
  return sendSuccess(response, { data });
});

export const listBannersPublic = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof publicBannersQuerySchema>>(request);
  const data = await listPublicBanners(query.placement);
  return sendSuccess(response, { data });
});

export const getHelpPagePublic = asyncHandler(async (_request, response) => {
  const data = await getPublicContentPage("help");
  return sendSuccess(response, { data });
});

export const getContactPagePublic = asyncHandler(async (_request, response) => {
  const data = await getPublicContentPage("contact");
  return sendSuccess(response, { data });
});

export const listPagesAdmin = asyncHandler(async (_request, response) => {
  const data = await listAdminPages();
  return sendSuccess(response, { data });
});

export const createPageAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createPageBodySchema>>(request);
  const data = await createAdminPage({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });
  return sendSuccess(response, { statusCode: 201, data });
});

export const updatePageAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof pageIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updatePageBodySchema>>(request);
  const data = await updateAdminPage({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    pageId: params.pageId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const getPageAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof pageIdParamsSchema>>(request);
  const data = await getAdminPage(params.pageId);
  return sendSuccess(response, { data });
});

export const publishPageAdmin = asyncHandler(async (request, response) => {
  readValidatedBody<z.infer<typeof contentMutationBodySchema>>(request);
  const params = readValidatedParams<z.infer<typeof pageIdParamsSchema>>(request);
  const data = await publishAdminPage(params.pageId);
  return sendSuccess(response, { data });
});

export const unpublishPageAdmin = asyncHandler(async (request, response) => {
  readValidatedBody<z.infer<typeof contentMutationBodySchema>>(request);
  const params = readValidatedParams<z.infer<typeof pageIdParamsSchema>>(request);
  const data = await unpublishAdminPage(params.pageId);
  return sendSuccess(response, { data });
});

export const archivePageAdmin = asyncHandler(async (request, response) => {
  readValidatedBody<z.infer<typeof contentMutationBodySchema>>(request);
  const params = readValidatedParams<z.infer<typeof pageIdParamsSchema>>(request);
  const data = await archiveAdminPage(params.pageId);
  return sendSuccess(response, { data });
});

export const restorePageAdmin = asyncHandler(async (request, response) => {
  readValidatedBody<z.infer<typeof contentMutationBodySchema>>(request);
  const params = readValidatedParams<z.infer<typeof pageIdParamsSchema>>(request);
  const data = await restoreAdminPage(params.pageId);
  return sendSuccess(response, { data });
});

export const deletePagePermanentAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof pageIdParamsSchema>>(request);
  const data = await deleteAdminPagePermanent({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    pageId: params.pageId
  });
  return sendSuccess(response, { data });
});

export const listBannersAdmin = asyncHandler(async (_request, response) => {
  const data = await listAdminBanners();
  return sendSuccess(response, { data });
});

export const createContentMediaUploadIntentAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof contentMediaUploadIntentBodySchema>>(request);
  const data = await createAdminContentMediaUploadIntent({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });
  return sendSuccess(response, { statusCode: 201, data });
});

export const createBannerAdmin = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createBannerBodySchema>>(request);
  const data = await createAdminBanner({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });
  return sendSuccess(response, { statusCode: 201, data });
});

export const updateBannerAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof bannerIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateBannerBodySchema>>(request);
  const data = await updateAdminBanner({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    bannerId: params.bannerId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const publishBannerAdmin = asyncHandler(async (request, response) => {
  readValidatedBody<z.infer<typeof contentMutationBodySchema>>(request);
  const params = readValidatedParams<z.infer<typeof bannerIdParamsSchema>>(request);
  const data = await publishAdminBanner({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    bannerId: params.bannerId
  });
  return sendSuccess(response, { data });
});

export const unpublishBannerAdmin = asyncHandler(async (request, response) => {
  readValidatedBody<z.infer<typeof contentMutationBodySchema>>(request);
  const params = readValidatedParams<z.infer<typeof bannerIdParamsSchema>>(request);
  const data = await unpublishAdminBanner({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    bannerId: params.bannerId
  });
  return sendSuccess(response, { data });
});

export const deleteBannerAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof bannerIdParamsSchema>>(request);
  const data = await deleteAdminBanner({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    bannerId: params.bannerId
  });
  return sendSuccess(response, { data });
});
