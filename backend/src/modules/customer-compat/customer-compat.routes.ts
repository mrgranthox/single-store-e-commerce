import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import {
  deleteAddress,
  deleteSecuritySession,
  getAccountOverview,
  getAddresses,
  getPreferences,
  getProfile,
  getSecurity,
  getSecuritySessions,
  patchAddress,
  patchPreferences,
  patchProfile,
  postAddress,
  postChangePassword,
  postDefaultAddress
} from "../account/account.controller";
import {
  accountPreferencesBodySchema,
  accountProfileBodySchema,
  accountSessionIdParamsSchema,
  addressBodySchema,
  addressIdParamsSchema,
  changePasswordBodySchema,
  defaultAddressBodySchema,
  updateAddressBodySchema
} from "../account/account.schemas";
import { requireCustomerActor } from "../auth/auth.middleware";
import {
  createCustomerOrderCancellation,
  getCustomerOrder,
  getCustomerOrderEligibility,
  getCustomerOrderTracking,
  listCustomerOrders
} from "../orders/orders.controller";
import {
  accountOrdersQuerySchema,
  customerCancelOrderBodySchema,
  orderIdParamsSchema
} from "../orders/orders.schemas";
import {
  createReviewCustomer,
  getOrderReviewEligibility,
  listMyReviews,
  updateReviewCustomer
} from "../reviews/reviews.controller";
import {
  createReviewBodySchema,
  myReviewsQuerySchema,
  reviewIdParamsSchema,
  updateReviewBodySchema
} from "../reviews/reviews.schemas";
import {
  createReturnRequestCustomer,
  getRefundEligibilityCustomer,
  getReturnEligibilityCustomer,
  listRefundsCustomer,
  listReturnsCustomer
} from "../returns/returns.controller";
import {
  adminRefundsQuerySchema,
  adminReturnsQuerySchema,
  createReturnBodySchema
} from "../returns/returns.schemas";
import {
  createTicketAttachmentCustomer,
  createTicketAttachmentUploadIntentCustomer,
  createTicketCustomer,
  createTicketMessageCustomer,
  getSupportIssueOptionsCustomer,
  getTicketCustomer,
  listTicketsCustomer
} from "../support/support.controller";
import {
  adminTicketsQuerySchema,
  createTicketAttachmentBodySchema,
  createTicketBodySchema,
  createTicketMessageBodySchema,
  ticketAttachmentUploadIntentBodySchema,
  ticketIdParamsSchema
} from "../support/support.schemas";
import {
  deleteWishlistItemById,
  getWishlist,
  postWishlistItem
} from "../wishlist/wishlist.controller";
import {
  createWishlistItemBodySchema,
  wishlistItemIdParamsSchema,
  wishlistListQuerySchema
} from "../wishlist/wishlist.schemas";

const router = Router();

router.get("/mobile/account", requireCustomerActor, getAccountOverview);
router.get("/mobile/account/profile", requireCustomerActor, getProfile);
router.patch(
  "/mobile/account/profile",
  requireCustomerActor,
  validateRequest({ body: accountProfileBodySchema }),
  patchProfile
);
router.get("/mobile/account/preferences", requireCustomerActor, getPreferences);
router.patch(
  "/mobile/account/preferences",
  requireCustomerActor,
  validateRequest({ body: accountPreferencesBodySchema }),
  patchPreferences
);
router.get("/mobile/account/addresses", requireCustomerActor, getAddresses);
router.post(
  "/mobile/account/addresses",
  requireCustomerActor,
  validateRequest({ body: addressBodySchema }),
  postAddress
);
router.patch(
  "/mobile/account/addresses/:addressId",
  requireCustomerActor,
  validateRequest({ params: addressIdParamsSchema, body: updateAddressBodySchema }),
  patchAddress
);
router.delete(
  "/mobile/account/addresses/:addressId",
  requireCustomerActor,
  validateRequest({ params: addressIdParamsSchema }),
  deleteAddress
);
router.post(
  "/mobile/account/addresses/:addressId/default",
  requireCustomerActor,
  validateRequest({ params: addressIdParamsSchema, body: defaultAddressBodySchema }),
  postDefaultAddress
);
router.get("/mobile/account/security", requireCustomerActor, getSecurity);
router.post(
  "/mobile/account/security/change-password",
  requireCustomerActor,
  validateRequest({ body: changePasswordBodySchema }),
  postChangePassword
);
router.get("/mobile/account/security/sessions", requireCustomerActor, getSecuritySessions);
router.delete(
  "/mobile/account/security/sessions/:sessionId",
  requireCustomerActor,
  validateRequest({ params: accountSessionIdParamsSchema }),
  deleteSecuritySession
);

router.get(
  "/mobile/wishlist",
  requireCustomerActor,
  validateRequest({ query: wishlistListQuerySchema }),
  getWishlist
);
router.post(
  "/mobile/wishlist/items",
  requireCustomerActor,
  validateRequest({ body: createWishlistItemBodySchema }),
  postWishlistItem
);
router.delete(
  "/mobile/wishlist/items/:wishlistItemId",
  requireCustomerActor,
  validateRequest({ params: wishlistItemIdParamsSchema }),
  deleteWishlistItemById
);

router.get(
  "/orders",
  requireCustomerActor,
  validateRequest({ query: accountOrdersQuerySchema }),
  listCustomerOrders
);
router.get(
  "/orders/:orderId",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getCustomerOrder
);
router.get(
  "/orders/:orderId/tracking",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getCustomerOrderTracking
);
router.post(
  "/orders/:orderId/cancel-request",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema, body: customerCancelOrderBodySchema }),
  createCustomerOrderCancellation
);
router.post(
  "/orders/:orderId/return-request",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema, body: createReturnBodySchema }),
  createReturnRequestCustomer
);

router.get(
  "/mobile/account/orders",
  requireCustomerActor,
  validateRequest({ query: accountOrdersQuerySchema }),
  listCustomerOrders
);
router.get(
  "/mobile/account/orders/:orderId",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getCustomerOrder
);
router.get(
  "/mobile/account/orders/:orderId/tracking",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getCustomerOrderTracking
);
router.get(
  "/mobile/account/orders/:orderId/cancellation-eligibility",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getCustomerOrderEligibility
);
router.post(
  "/mobile/account/orders/:orderId/cancel",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema, body: customerCancelOrderBodySchema }),
  createCustomerOrderCancellation
);

router.get(
  "/account/reviews",
  requireCustomerActor,
  validateRequest({ query: myReviewsQuerySchema }),
  listMyReviews
);
router.post(
  "/account/reviews",
  requireCustomerActor,
  validateRequest({ body: createReviewBodySchema }),
  createReviewCustomer
);
router.patch(
  "/account/reviews/:reviewId",
  requireCustomerActor,
  validateRequest({ params: reviewIdParamsSchema, body: updateReviewBodySchema }),
  updateReviewCustomer
);
router.get(
  "/account/orders/:orderId/cancellation-eligibility",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getCustomerOrderEligibility
);
router.get(
  "/account/orders/:orderId/review-eligibility",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getOrderReviewEligibility
);

router.get(
  "/mobile/account/reviews",
  requireCustomerActor,
  validateRequest({ query: myReviewsQuerySchema }),
  listMyReviews
);
router.post(
  "/mobile/account/reviews",
  requireCustomerActor,
  validateRequest({ body: createReviewBodySchema }),
  createReviewCustomer
);
router.patch(
  "/mobile/account/reviews/:reviewId",
  requireCustomerActor,
  validateRequest({ params: reviewIdParamsSchema, body: updateReviewBodySchema }),
  updateReviewCustomer
);
router.get(
  "/mobile/account/orders/:orderId/review-eligibility",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getOrderReviewEligibility
);

router.get(
  "/account/support/tickets",
  requireCustomerActor,
  validateRequest({ query: adminTicketsQuerySchema }),
  listTicketsCustomer
);
router.post(
  "/account/support/tickets",
  requireCustomerActor,
  validateRequest({ body: createTicketBodySchema }),
  createTicketCustomer
);
router.get(
  "/account/support/tickets/:ticketId",
  requireCustomerActor,
  validateRequest({ params: ticketIdParamsSchema }),
  getTicketCustomer
);
router.post(
  "/account/support/tickets/:ticketId/messages",
  requireCustomerActor,
  validateRequest({ params: ticketIdParamsSchema, body: createTicketMessageBodySchema }),
  createTicketMessageCustomer
);
router.post(
  "/account/support/tickets/:ticketId/attachments",
  requireCustomerActor,
  validateRequest({ params: ticketIdParamsSchema, body: createTicketAttachmentBodySchema }),
  createTicketAttachmentCustomer
);
router.post(
  "/account/support/tickets/:ticketId/attachments/upload-intents",
  requireCustomerActor,
  validateRequest({ params: ticketIdParamsSchema, body: ticketAttachmentUploadIntentBodySchema }),
  createTicketAttachmentUploadIntentCustomer
);

router.get(
  "/mobile/support",
  requireCustomerActor,
  validateRequest({ query: adminTicketsQuerySchema }),
  listTicketsCustomer
);
router.post(
  "/mobile/support/tickets",
  requireCustomerActor,
  validateRequest({ body: createTicketBodySchema }),
  createTicketCustomer
);
router.get("/mobile/support/issues", requireCustomerActor, getSupportIssueOptionsCustomer);
router.get(
  "/mobile/account/support",
  requireCustomerActor,
  validateRequest({ query: adminTicketsQuerySchema }),
  listTicketsCustomer
);
router.get(
  "/mobile/account/support/:ticketId",
  requireCustomerActor,
  validateRequest({ params: ticketIdParamsSchema }),
  getTicketCustomer
);
router.post(
  "/mobile/account/support/:ticketId/messages",
  requireCustomerActor,
  validateRequest({ params: ticketIdParamsSchema, body: createTicketMessageBodySchema }),
  createTicketMessageCustomer
);
router.post(
  "/mobile/account/support/:ticketId/attachments",
  requireCustomerActor,
  validateRequest({ params: ticketIdParamsSchema, body: createTicketAttachmentBodySchema }),
  createTicketAttachmentCustomer
);
router.post(
  "/mobile/account/support/:ticketId/attachments/upload-intents",
  requireCustomerActor,
  validateRequest({ params: ticketIdParamsSchema, body: ticketAttachmentUploadIntentBodySchema }),
  createTicketAttachmentUploadIntentCustomer
);

router.get(
  "/account/returns",
  requireCustomerActor,
  validateRequest({ query: adminReturnsQuerySchema }),
  listReturnsCustomer
);
router.get(
  "/account/refunds",
  requireCustomerActor,
  validateRequest({ query: adminRefundsQuerySchema }),
  listRefundsCustomer
);
router.post(
  "/account/orders/:orderId/returns/eligibility",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getReturnEligibilityCustomer
);
router.get(
  "/account/orders/:orderId/return-eligibility",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getReturnEligibilityCustomer
);
router.post(
  "/account/orders/:orderId/returns",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema, body: createReturnBodySchema }),
  createReturnRequestCustomer
);
router.get(
  "/account/orders/:orderId/refund-eligibility",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getRefundEligibilityCustomer
);

router.get(
  "/mobile/account/returns",
  requireCustomerActor,
  validateRequest({ query: adminReturnsQuerySchema }),
  listReturnsCustomer
);
router.get(
  "/mobile/account/refunds",
  requireCustomerActor,
  validateRequest({ query: adminRefundsQuerySchema }),
  listRefundsCustomer
);
router.get(
  "/mobile/account/orders/:orderId/return-eligibility",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getReturnEligibilityCustomer
);
router.post(
  "/mobile/account/orders/:orderId/returns",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema, body: createReturnBodySchema }),
  createReturnRequestCustomer
);
router.get(
  "/mobile/account/orders/:orderId/refund-eligibility",
  requireCustomerActor,
  validateRequest({ params: orderIdParamsSchema }),
  getRefundEligibilityCustomer
);

export const customerCompatRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/mobile/account", summary: "Return the mobile account dashboard payload.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/profile", summary: "Return the authenticated mobile customer's profile.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "PATCH", path: "/api/v1/mobile/account/profile", summary: "Update the authenticated mobile customer's profile.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/preferences", summary: "Return mobile communication preferences.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "PATCH", path: "/api/v1/mobile/account/preferences", summary: "Update mobile communication preferences.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/addresses", summary: "List mobile saved addresses.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/mobile/account/addresses", summary: "Create a mobile saved address.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "PATCH", path: "/api/v1/mobile/account/addresses/:addressId", summary: "Update a mobile saved address.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "DELETE", path: "/api/v1/mobile/account/addresses/:addressId", summary: "Delete a mobile saved address.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/security", summary: "Return the mobile account security summary.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/mobile/account/security/change-password", summary: "Change the mobile customer's password through Clerk.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/security/sessions", summary: "List mobile customer sessions.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "DELETE", path: "/api/v1/mobile/account/security/sessions/:sessionId", summary: "Revoke a mobile customer session.", tags: ["account", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/wishlist", summary: "List mobile wishlist items.", tags: ["wishlist", "mobile"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/mobile/wishlist/items", summary: "Add an item to the mobile wishlist.", tags: ["wishlist", "mobile"], auth: "authenticated" },
    { method: "DELETE", path: "/api/v1/mobile/wishlist/items/:wishlistItemId", summary: "Remove an item from the mobile wishlist.", tags: ["wishlist", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/orders", summary: "List the authenticated customer's orders via the top-level customer order contract.", tags: ["orders"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/orders/:orderId", summary: "Fetch authenticated customer order detail via the top-level customer order contract.", tags: ["orders"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/orders/:orderId/tracking", summary: "Fetch authenticated customer shipment tracking via the top-level customer order contract.", tags: ["orders"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/orders/:orderId/cancel-request", summary: "Submit a customer cancellation request via the top-level customer order contract.", tags: ["orders"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/orders/:orderId/return-request", summary: "Submit a customer return request via the top-level customer order contract.", tags: ["orders"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/orders", summary: "List mobile account orders.", tags: ["orders", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/orders/:orderId", summary: "Fetch a mobile account order.", tags: ["orders", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/orders/:orderId/tracking", summary: "Fetch mobile shipment tracking detail.", tags: ["orders", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/orders/:orderId/cancellation-eligibility", summary: "Return mobile order cancellation eligibility.", tags: ["orders", "mobile"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/mobile/account/orders/:orderId/cancel", summary: "Submit a mobile order cancellation request.", tags: ["orders", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/orders/:orderId/cancellation-eligibility", summary: "Return account-order cancellation eligibility.", tags: ["orders"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/reviews", summary: "List the authenticated customer's reviews via the account route contract.", tags: ["reviews"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/account/reviews", summary: "Create a review via the account route contract.", tags: ["reviews"], auth: "authenticated" },
    { method: "PATCH", path: "/api/v1/account/reviews/:reviewId", summary: "Update a review via the account route contract.", tags: ["reviews"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/orders/:orderId/review-eligibility", summary: "Return review eligibility for a specific account order.", tags: ["reviews"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/reviews", summary: "List mobile account reviews.", tags: ["reviews", "mobile"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/mobile/account/reviews", summary: "Create a mobile account review.", tags: ["reviews", "mobile"], auth: "authenticated" },
    { method: "PATCH", path: "/api/v1/mobile/account/reviews/:reviewId", summary: "Update a mobile account review.", tags: ["reviews", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/orders/:orderId/review-eligibility", summary: "Return mobile order review eligibility.", tags: ["reviews", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/support/tickets", summary: "List customer support tickets via the account route contract.", tags: ["support"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/account/support/tickets", summary: "Create a customer support ticket via the account route contract.", tags: ["support"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/support/tickets/:ticketId", summary: "Fetch customer support ticket detail via the account route contract.", tags: ["support"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/account/support/tickets/:ticketId/messages", summary: "Reply to a customer support ticket via the account route contract.", tags: ["support"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/support", summary: "Return the mobile support center payload.", tags: ["support", "mobile"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/mobile/support/tickets", summary: "Create a mobile support ticket.", tags: ["support", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/support/issues", summary: "List structured mobile support issue categories.", tags: ["support", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/support", summary: "List mobile account support tickets.", tags: ["support", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/support/:ticketId", summary: "Fetch mobile account support ticket detail.", tags: ["support", "mobile"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/mobile/account/support/:ticketId/messages", summary: "Reply to a mobile account support ticket.", tags: ["support", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/returns", summary: "List customer returns via the account route contract.", tags: ["returns"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/refunds", summary: "List customer refunds via the account route contract.", tags: ["refunds"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/account/orders/:orderId/returns/eligibility", summary: "Return return eligibility for a specific account order.", tags: ["returns"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/orders/:orderId/return-eligibility", summary: "Return account-order return eligibility.", tags: ["returns"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/account/orders/:orderId/returns", summary: "Create a return request via the account route contract.", tags: ["returns"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/orders/:orderId/refund-eligibility", summary: "Return account-order refund eligibility.", tags: ["refunds"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/returns", summary: "List mobile account returns.", tags: ["returns", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/refunds", summary: "List mobile account refunds.", tags: ["refunds", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/orders/:orderId/return-eligibility", summary: "Return mobile order return eligibility.", tags: ["returns", "mobile"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/mobile/account/orders/:orderId/returns", summary: "Create a mobile order return request.", tags: ["returns", "mobile"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/mobile/account/orders/:orderId/refund-eligibility", summary: "Return mobile order refund eligibility.", tags: ["refunds", "mobile"], auth: "authenticated" }
  ]
};
