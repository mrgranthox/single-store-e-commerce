import { z } from "zod";

import { requireCustomerUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
import {
  createWishlistItemBodySchema,
  wishlistItemIdParamsSchema,
  wishlistListQuerySchema
} from "./wishlist.schemas";
import { createWishlistItem, deleteWishlistItem, listWishlistItems } from "./wishlist.service";

export const getWishlist = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof wishlistListQuerySchema>>(request);
  const data = await listWishlistItems(requireCustomerUserId(request.context.actor.userId), query);

  return sendSuccess(response, {
    data: {
      items: data.items,
      pagination: data.pagination
    }
  });
});

export const postWishlistItem = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createWishlistItemBodySchema>>(request);
  const data = await createWishlistItem({
    userId: requireCustomerUserId(request.context.actor.userId),
    productId: body.productId,
    variantId: body.variantId
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const deleteWishlistItemById = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof wishlistItemIdParamsSchema>>(request);
  const data = await deleteWishlistItem({
    userId: requireCustomerUserId(request.context.actor.userId),
    itemId: params.itemId ?? params.wishlistItemId!
  });

  return sendSuccess(response, { data });
});
