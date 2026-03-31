import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  archivePageAdmin,
  createBannerAdmin,
  createContentMediaUploadIntentAdmin,
  createPageAdmin,
  deleteBannerAdmin,
  deletePagePermanentAdmin,
  getContactPagePublic,
  getHelpPagePublic,
  getPageAdmin,
  getPagePublic,
  listBannersAdmin,
  listBannersPublic,
  listPagesAdmin,
  publishBannerAdmin,
  publishPageAdmin,
  restorePageAdmin,
  unpublishBannerAdmin,
  unpublishPageAdmin,
  updateBannerAdmin,
  updatePageAdmin
} from "./content.controller";
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

const router = Router();

router.get("/content/pages/:slug", validateRequest({ params: pageSlugParamsSchema }), getPagePublic);
router.get("/content/banners", validateRequest({ query: publicBannersQuerySchema }), listBannersPublic);
router.get("/content/help", getHelpPagePublic);
router.get("/content/contact", getContactPagePublic);

router.get(
  "/admin/content/pages",
  requireAdminActor,
  requirePermissions(["content.pages.read"]),
  listPagesAdmin
);
router.get(
  "/admin/content/pages/:pageId",
  requireAdminActor,
  requirePermissions(["content.pages.read"]),
  validateRequest({ params: pageIdParamsSchema }),
  getPageAdmin
);
router.post(
  "/admin/content/pages",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ body: createPageBodySchema }),
  createPageAdmin
);
router.patch(
  "/admin/content/pages/:pageId",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ params: pageIdParamsSchema, body: updatePageBodySchema }),
  updatePageAdmin
);
router.post(
  "/admin/content/pages/:pageId/publish",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ params: pageIdParamsSchema, body: contentMutationBodySchema }),
  publishPageAdmin
);
router.post(
  "/admin/content/pages/:pageId/unpublish",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ params: pageIdParamsSchema, body: contentMutationBodySchema }),
  unpublishPageAdmin
);
router.post(
  "/admin/content/pages/:pageId/archive",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ params: pageIdParamsSchema, body: contentMutationBodySchema }),
  archivePageAdmin
);
router.post(
  "/admin/content/pages/:pageId/restore",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ params: pageIdParamsSchema, body: contentMutationBodySchema }),
  restorePageAdmin
);
router.delete(
  "/admin/content/pages/:pageId",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ params: pageIdParamsSchema }),
  deletePagePermanentAdmin
);
router.get(
  "/admin/content/banners",
  requireAdminActor,
  requirePermissions(["content.pages.read"]),
  listBannersAdmin
);
router.post(
  "/admin/content/media/upload-intents",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ body: contentMediaUploadIntentBodySchema }),
  createContentMediaUploadIntentAdmin
);
router.post(
  "/admin/content/banners",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ body: createBannerBodySchema }),
  createBannerAdmin
);
router.patch(
  "/admin/content/banners/:bannerId",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ params: bannerIdParamsSchema, body: updateBannerBodySchema }),
  updateBannerAdmin
);
router.post(
  "/admin/content/banners/:bannerId/publish",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ params: bannerIdParamsSchema, body: contentMutationBodySchema }),
  publishBannerAdmin
);
router.post(
  "/admin/content/banners/:bannerId/unpublish",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ params: bannerIdParamsSchema, body: contentMutationBodySchema }),
  unpublishBannerAdmin
);
router.delete(
  "/admin/content/banners/:bannerId",
  requireAdminActor,
  requirePermissions(["content.pages.write"]),
  validateRequest({ params: bannerIdParamsSchema }),
  deleteBannerAdmin
);

export const contentRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/content/pages/:slug", summary: "Fetch a published CMS page by slug.", tags: ["content"], auth: "public" },
    { method: "GET", path: "/api/v1/content/banners", summary: "List published banners.", tags: ["content"], auth: "public" },
    { method: "GET", path: "/api/v1/content/help", summary: "Fetch the help page.", tags: ["content"], auth: "public" },
    { method: "GET", path: "/api/v1/content/contact", summary: "Fetch the contact page.", tags: ["content"], auth: "public" },
    { method: "GET", path: "/api/v1/admin/content/pages", summary: "List admin CMS pages.", tags: ["content"], auth: "admin", permissions: ["content.pages.read"] },
    { method: "GET", path: "/api/v1/admin/content/pages/:pageId", summary: "Fetch admin CMS page detail.", tags: ["content"], auth: "admin", permissions: ["content.pages.read"] },
    { method: "POST", path: "/api/v1/admin/content/pages", summary: "Create a CMS page.", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] },
    { method: "PATCH", path: "/api/v1/admin/content/pages/:pageId", summary: "Update a CMS page.", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] },
    { method: "POST", path: "/api/v1/admin/content/pages/:pageId/publish", summary: "Publish a CMS page.", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] },
    { method: "POST", path: "/api/v1/admin/content/pages/:pageId/unpublish", summary: "Unpublish a CMS page (draft).", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] },
    { method: "POST", path: "/api/v1/admin/content/pages/:pageId/archive", summary: "Archive a CMS page.", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] },
    { method: "POST", path: "/api/v1/admin/content/pages/:pageId/restore", summary: "Restore an archived CMS page to draft.", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] },
    { method: "DELETE", path: "/api/v1/admin/content/pages/:pageId", summary: "Permanently delete an archived CMS page.", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] },
    { method: "GET", path: "/api/v1/admin/content/banners", summary: "List admin banners.", tags: ["content"], auth: "admin", permissions: ["content.pages.read"] },
    { method: "POST", path: "/api/v1/admin/content/media/upload-intents", summary: "Create a signed upload intent for banner or CMS media.", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] },
    { method: "POST", path: "/api/v1/admin/content/banners", summary: "Create a banner.", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] },
    { method: "PATCH", path: "/api/v1/admin/content/banners/:bannerId", summary: "Update a banner.", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] },
    { method: "POST", path: "/api/v1/admin/content/banners/:bannerId/publish", summary: "Publish a banner.", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] },
    { method: "POST", path: "/api/v1/admin/content/banners/:bannerId/unpublish", summary: "Unpublish a banner.", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] },
    { method: "DELETE", path: "/api/v1/admin/content/banners/:bannerId", summary: "Delete a banner.", tags: ["content"], auth: "admin", permissions: ["content.pages.write"] }
  ]
};
