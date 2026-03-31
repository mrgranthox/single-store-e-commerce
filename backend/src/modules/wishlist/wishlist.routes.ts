import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireCustomerActor } from "../auth/auth.middleware";
import { deleteWishlistItemById, getWishlist, postWishlistItem } from "./wishlist.controller";
import {
  createWishlistItemBodySchema,
  wishlistItemIdParamsSchema,
  wishlistListQuerySchema
} from "./wishlist.schemas";

const router = Router();

router.get(
  "/account/wishlist",
  requireCustomerActor,
  validateRequest({ query: wishlistListQuerySchema }),
  getWishlist
);
router.post(
  "/account/wishlist/items",
  requireCustomerActor,
  validateRequest({ body: createWishlistItemBodySchema }),
  postWishlistItem
);
router.delete(
  "/account/wishlist/items/:itemId",
  requireCustomerActor,
  validateRequest({ params: wishlistItemIdParamsSchema }),
  deleteWishlistItemById
);

export const wishlistRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/account/wishlist", summary: "List the authenticated customer's wishlist items.", tags: ["wishlist"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/account/wishlist/items", summary: "Add a product or variant to the authenticated customer's wishlist.", tags: ["wishlist"], auth: "authenticated" },
    { method: "DELETE", path: "/api/v1/account/wishlist/items/:itemId", summary: "Remove an item from the authenticated customer's wishlist.", tags: ["wishlist"], auth: "authenticated" }
  ]
};
