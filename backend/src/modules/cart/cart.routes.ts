import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import {
  applyCartCoupon,
  createCartItem,
  deleteCartCoupon,
  deleteCartItem,
  getCart,
  updateCartItem
} from "./cart.controller";
import {
  addCartItemBodySchema,
  applyCouponBodySchema,
  cartItemIdParamsSchema,
  updateCartItemBodySchema
} from "./cart.schemas";

const router = Router();

router.get("/cart", getCart);
router.post("/cart/items", validateRequest({ body: addCartItemBodySchema }), createCartItem);
router.patch("/cart/items/:itemId", validateRequest({ params: cartItemIdParamsSchema, body: updateCartItemBodySchema }), updateCartItem);
router.delete("/cart/items/:itemId", validateRequest({ params: cartItemIdParamsSchema }), deleteCartItem);
router.post("/cart/coupon", validateRequest({ body: applyCouponBodySchema }), applyCartCoupon);
router.post("/cart/apply-coupon", validateRequest({ body: applyCouponBodySchema }), applyCartCoupon);
router.delete("/cart/coupon", deleteCartCoupon);

export const cartRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/cart", summary: "Get the current customer or guest cart.", tags: ["cart"], auth: "public" },
    { method: "POST", path: "/api/v1/cart/items", summary: "Add an item to the current cart.", tags: ["cart"], auth: "public" },
    { method: "PATCH", path: "/api/v1/cart/items/:itemId", summary: "Update a cart item quantity.", tags: ["cart"], auth: "public" },
    { method: "DELETE", path: "/api/v1/cart/items/:itemId", summary: "Remove a cart item.", tags: ["cart"], auth: "public" },
    { method: "POST", path: "/api/v1/cart/coupon", summary: "Apply a coupon code to the current cart via the customer contract alias.", tags: ["cart"], auth: "public" },
    { method: "POST", path: "/api/v1/cart/apply-coupon", summary: "Apply a coupon code to the current cart.", tags: ["cart"], auth: "public" },
    { method: "DELETE", path: "/api/v1/cart/coupon", summary: "Remove the coupon from the current cart.", tags: ["cart"], auth: "public" }
  ]
};
