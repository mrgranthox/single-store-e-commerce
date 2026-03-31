# E-Commerce Customer API Contract

## Executive overview
This document defines the customer-facing API contract for the single-store e-commerce platform. It covers the public storefront, authenticated customer account, cart and checkout, post-purchase service, and content/trust surfaces.

The goal is to provide an implementation-grade contract that frontend engineers and AI coding agents can use with less ambiguity.

## API design principles
- Use `/api` as the base path.
- Use JSON for request and response bodies.
- Return consistent envelopes:
  - success response: `{ "success": true, "data": ... }`
  - error response: `{ "success": false, "error": { "code": "...", "message": "...", "details": ... } }`
- Do not trust frontend eligibility assumptions; backend returns explicit eligibility flags.
- Use pagination on list endpoints.
- Use authenticated routes for account state and write actions that require user identity.

## Public storefront endpoints
### Catalog and discovery
- `GET /api/products`
- `GET /api/products/:slug`
- `GET /api/products/:slug/reviews`
- `GET /api/categories`
- `GET /api/categories/:slug/products`
- `GET /api/brands/:slug/products`
- `GET /api/search`

### Content and trust
- `GET /api/banners`
- `GET /api/pages/:slug`

### Guest order tracking
- `POST /api/orders/track`

## Wishlist endpoints
- `GET /api/account/wishlist`
- `POST /api/account/wishlist/items`
- `DELETE /api/account/wishlist/items/:itemId`

## Cart endpoints
- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:itemId`
- `DELETE /api/cart/items/:itemId`
- `POST /api/cart/coupon`
- `DELETE /api/cart/coupon`

## Checkout endpoints
- `POST /api/checkout/validate`
- `POST /api/checkout/create-order`
- `POST /api/payments/initialize`
- `POST /api/payments/webhook`

## Auth and identity endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/verify-email/resend`
- `POST /api/auth/verify-email/confirm`
- `GET /api/auth/session`

## Account endpoints
- `GET /api/account/profile`
- `PATCH /api/account/profile`
- `GET /api/account/preferences`
- `PATCH /api/account/preferences`
- `GET /api/account/security`
- `POST /api/account/security/change-password`
- `GET /api/account/addresses`
- `POST /api/account/addresses`
- `PATCH /api/account/addresses/:addressId`
- `DELETE /api/account/addresses/:addressId`
- `POST /api/account/addresses/:addressId/default`

## Orders and post-purchase endpoints
- `GET /api/account/orders`
- `GET /api/account/orders/:orderId`
- `GET /api/account/orders/:orderId/tracking`
- `POST /api/account/orders/:orderId/cancel`

## Reviews endpoints
- `GET /api/account/reviews`
- `POST /api/account/reviews`
- `PATCH /api/account/reviews/:reviewId`

## Support endpoints
- `GET /api/account/support/tickets`
- `POST /api/account/support/tickets`
- `GET /api/account/support/tickets/:ticketId`
- `POST /api/account/support/tickets/:ticketId/messages`

## Returns and refunds endpoints
- `GET /api/account/returns`
- `GET /api/account/refunds`
- `POST /api/account/orders/:orderId/returns/eligibility`
- `POST /api/account/orders/:orderId/returns`

## Public help/contact endpoints
- `POST /api/support/contact`
- `POST /api/products/:slug/inquiry`

## Eligibility flags the frontend should expect
- `canCheckout`
- `guestCheckoutAllowed`
- `canTrackAsGuest`
- `canReview`
- `canCancel`
- `canReturn`
- `canRequestRefund`
- `canReplyToTicket`
- `canEditReview`

## Standard customer-facing error codes
- `AUTH_REQUIRED`
- `INVALID_CREDENTIALS`
- `EMAIL_NOT_VERIFIED`
- `CART_EMPTY`
- `ITEM_OUT_OF_STOCK`
- `PRICE_CHANGED`
- `COUPON_INVALID`
- `ORDER_NOT_FOUND`
- `ORDER_NOT_ELIGIBLE`
- `REVIEW_NOT_ELIGIBLE`
- `RETURN_WINDOW_CLOSED`
- `SUPPORT_TICKET_NOT_FOUND`
- `VALIDATION_ERROR`

## Pagination contract
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 0,
      "totalPages": 0
    }
  }
}
```

## Final position
This contract is designed to support the full 50-screen customer experience: discovery, cart and checkout, account area, reviews, support, returns, refunds, and trust content.
