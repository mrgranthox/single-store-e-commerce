import { z } from "zod";

import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams
} from "../../common/validation/validate-request";
import {
  addCartItemBodySchema,
  applyCouponBodySchema,
  cartItemIdParamsSchema,
  updateCartItemBodySchema
} from "./cart.schemas";
import {
  addCartItem,
  applyCoupon,
  getCartView,
  removeCartItem,
  removeCoupon,
  updateCartItemQuantity
} from "./cart.service";

const buildContext = (request: Parameters<typeof getCartView>[0] extends never ? never : any) => ({
  actor: request.context.actor,
  sessionId: request.context.sessionId
});

export const getCart = asyncHandler(async (request, response) => {
  const data = await getCartView(buildContext(request));
  return sendSuccess(response, { data });
});

export const createCartItem = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof addCartItemBodySchema>>(request);
  const data = await addCartItem(buildContext(request), body);
  return sendSuccess(response, { statusCode: 201, data });
});

export const updateCartItem = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof cartItemIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateCartItemBodySchema>>(request);
  const data = await updateCartItemQuantity(buildContext(request), {
    itemId: params.itemId,
    ...body
  });
  return sendSuccess(response, { data });
});

export const deleteCartItem = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof cartItemIdParamsSchema>>(request);
  const data = await removeCartItem(buildContext(request), params);
  return sendSuccess(response, { data });
});

export const applyCartCoupon = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof applyCouponBodySchema>>(request);
  const data = await applyCoupon(buildContext(request), body);
  return sendSuccess(response, { data });
});

export const deleteCartCoupon = asyncHandler(async (request, response) => {
  const data = await removeCoupon(buildContext(request));
  return sendSuccess(response, { data });
});
