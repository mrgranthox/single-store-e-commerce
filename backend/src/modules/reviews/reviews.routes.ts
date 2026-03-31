import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireCustomerActor } from "../auth/auth.middleware";
import { requireAdminActor, requirePermissions } from "../roles-permissions/rbac.middleware";
import {
  createReviewCustomer,
  getReviewAdmin,
  listMyReviews,
  listProductReviewsPublic,
  listReviewEligibility,
  listReviewsAdmin,
  moderateReviewAdmin,
  updateReviewCustomer
} from "./reviews.controller";
import {
  adminReviewsQuerySchema,
  createReviewBodySchema,
  moderateReviewBodySchema,
  myReviewsQuerySchema,
  productSlugParamsSchema,
  reviewIdParamsSchema,
  updateReviewBodySchema
} from "./reviews.schemas";

const router = Router();

router.get(
  "/catalog/products/:productSlug/reviews",
  validateRequest({ params: productSlugParamsSchema, query: myReviewsQuerySchema }),
  listProductReviewsPublic
);

router.get("/reviews/me", requireCustomerActor, validateRequest({ query: myReviewsQuerySchema }), listMyReviews);
router.get("/reviews/eligibility", requireCustomerActor, listReviewEligibility);
router.post("/reviews", requireCustomerActor, validateRequest({ body: createReviewBodySchema }), createReviewCustomer);
router.patch(
  "/reviews/:reviewId",
  requireCustomerActor,
  validateRequest({ params: reviewIdParamsSchema, body: updateReviewBodySchema }),
  updateReviewCustomer
);

router.get(
  "/admin/catalog/reviews",
  requireAdminActor,
  requirePermissions(["reviews.moderate"]),
  validateRequest({ query: adminReviewsQuerySchema }),
  listReviewsAdmin
);
router.get(
  "/admin/catalog/reviews/:reviewId",
  requireAdminActor,
  requirePermissions(["reviews.moderate"]),
  validateRequest({ params: reviewIdParamsSchema }),
  getReviewAdmin
);
router.post(
  "/admin/catalog/reviews/:reviewId/moderate",
  requireAdminActor,
  requirePermissions(["reviews.moderate"]),
  validateRequest({ params: reviewIdParamsSchema, body: moderateReviewBodySchema }),
  moderateReviewAdmin
);

export const reviewsRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/catalog/products/:productSlug/reviews", summary: "List published reviews for a product.", tags: ["reviews"], auth: "public" },
    { method: "GET", path: "/api/v1/reviews/me", summary: "List the authenticated customer's reviews.", tags: ["reviews"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/reviews/eligibility", summary: "List delivered purchases eligible for review.", tags: ["reviews"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/reviews", summary: "Create a review for an eligible delivered order item.", tags: ["reviews"], auth: "authenticated" },
    { method: "PATCH", path: "/api/v1/reviews/:reviewId", summary: "Update the authenticated customer's review.", tags: ["reviews"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/admin/catalog/reviews", summary: "List reviews for moderation.", tags: ["reviews"], auth: "admin", permissions: ["reviews.moderate"] },
    { method: "GET", path: "/api/v1/admin/catalog/reviews/:reviewId", summary: "Fetch admin review detail.", tags: ["reviews"], auth: "admin", permissions: ["reviews.moderate"] },
    { method: "POST", path: "/api/v1/admin/catalog/reviews/:reviewId/moderate", summary: "Moderate a customer review.", tags: ["reviews"], auth: "admin", permissions: ["reviews.moderate"] }
  ]
};
