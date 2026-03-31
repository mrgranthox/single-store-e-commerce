import { z } from "zod";

import { requireAdminUserId, requireCustomerUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
import {
  adminReviewsQuerySchema,
  createReviewBodySchema,
  moderateReviewBodySchema,
  myReviewsQuerySchema,
  orderIdParamsSchema,
  productSlugParamsSchema,
  reviewIdParamsSchema,
  updateReviewBodySchema
} from "./reviews.schemas";
import {
  createCustomerReview,
  getAdminReviewDetail,
  getCustomerOrderReviewEligibility,
  listAdminReviews,
  listCustomerReviewEligibility,
  listCustomerReviews,
  listPublicProductReviews,
  moderateAdminReview,
  updateCustomerReview
} from "./reviews.service";

const buildReviewBodyText = (input: {
  title?: string;
  body?: string;
  comment?: string;
}) => {
  const normalizedBody = input.body?.trim();
  const normalizedComment = input.comment?.trim();
  const normalizedTitle = input.title?.trim();

  if (normalizedBody) {
    return normalizedBody;
  }

  if (normalizedComment && normalizedTitle) {
    return `${normalizedTitle}\n\n${normalizedComment}`;
  }

  return normalizedComment ?? normalizedTitle;
};

export const listProductReviewsPublic = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof productSlugParamsSchema>>(request);
  const query = readValidatedQuery<z.infer<typeof myReviewsQuerySchema>>(request);
  const data = await listPublicProductReviews(params.productSlug, query);

  return sendSuccess(response, {
    data: {
      items: data.items,
      summary: data.summary
    },
    meta: data.pagination
  });
});

export const listMyReviews = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof myReviewsQuerySchema>>(request);
  const data = await listCustomerReviews(requireCustomerUserId(request.context.actor.userId), query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const listReviewEligibility = asyncHandler(async (request, response) => {
  const data = await listCustomerReviewEligibility(requireCustomerUserId(request.context.actor.userId));
  return sendSuccess(response, { data });
});

export const createReviewCustomer = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createReviewBodySchema>>(request);
  const data = await createCustomerReview(requireCustomerUserId(request.context.actor.userId), {
    orderItemId: body.orderItemId,
    rating: body.rating,
    body: buildReviewBodyText(body)
  });

  return sendSuccess(response, {
    statusCode: 201,
    data
  });
});

export const updateReviewCustomer = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof reviewIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateReviewBodySchema>>(request);
  const data = await updateCustomerReview(requireCustomerUserId(request.context.actor.userId), {
    reviewId: params.reviewId,
    rating: body.rating,
    body: buildReviewBodyText(body)
  });

  return sendSuccess(response, { data });
});

export const getOrderReviewEligibility = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof orderIdParamsSchema>>(request);
  const data = await getCustomerOrderReviewEligibility(
    requireCustomerUserId(request.context.actor.userId),
    params.orderId
  );

  return sendSuccess(response, { data });
});

export const listReviewsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof adminReviewsQuerySchema>>(request);
  const data = await listAdminReviews(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const getReviewAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof reviewIdParamsSchema>>(request);
  const data = await getAdminReviewDetail(params.reviewId);

  return sendSuccess(response, { data });
});

export const moderateReviewAdmin = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof reviewIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof moderateReviewBodySchema>>(request);
  const data = await moderateAdminReview({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    reviewId: params.reviewId,
    ...body
  });

  return sendSuccess(response, { data });
});
