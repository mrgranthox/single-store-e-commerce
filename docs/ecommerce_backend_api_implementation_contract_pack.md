# E-Commerce Backend API Implementation Contract Pack

## Executive overview
This document defines the implementation-grade backend API contract for the single-store-first e-commerce platform. It unifies the needs of the 94-screen admin web app, 50-screen customer web app, and 48-screen mobile app, while preserving a clean path to future multi-store expansion.

The contract is designed so engineering teams and coding agents can implement APIs consistently across:
- admin operations and governance
- customer commerce and post-purchase journeys
- mobile support and offline-aware client behavior
- auditability, security, alerts, and investigations

## Platform API position
Recommended base path:
- `/api/v1`

Recommended API groups:
- `/api/v1/auth`
- `/api/v1/account`
- `/api/v1/catalog`
- `/api/v1/cart`
- `/api/v1/checkout`
- `/api/v1/orders`
- `/api/v1/payments`
- `/api/v1/shipping`
- `/api/v1/reviews`
- `/api/v1/support`
- `/api/v1/content`
- `/api/v1/admin`
- `/api/v1/admin/catalog`
- `/api/v1/admin/inventory`
- `/api/v1/admin/orders`
- `/api/v1/admin/payments`
- `/api/v1/admin/customers`
- `/api/v1/admin/support`
- `/api/v1/admin/content`
- `/api/v1/admin/marketing`
- `/api/v1/admin/reports`
- `/api/v1/admin/security`
- `/api/v1/admin/system`

## Global API conventions

### Authentication
Use:
- secure cookie session or
- JWT access token + refresh token rotation

Recommended roles:
- customer
- admin
- super_admin
- support
- warehouse_staff
- moderator

### Response envelope
Success:
```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Error:
```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_ELIGIBLE_FOR_RETURN",
    "message": "This order is not eligible for return.",
    "details": {}
  }
}
```

### Pagination
Recommended query params:
- `page`
- `pageSize`
- `sortBy`
- `sortOrder`

Paginated response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 400,
    "totalPages": 16
  }
}
```

### Filtering
Use query-string filters consistently, for example:
- `status=paid`
- `severity=high`
- `brandId=...`
- `dateFrom=...&dateTo=...`

### Idempotency
Require idempotency keys for:
- checkout creation
- payment initialization
- refund initiation
- destructive retry-safe operations where duplication is dangerous

Header:
- `Idempotency-Key`

### Audit and sensitive action policy
All sensitive admin mutations should:
- verify permission
- optionally require confirmation reason
- create audit log
- create admin action log where before/after values matter

## Auth and account APIs

### Public auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`

### Customer account
- `GET /api/v1/account`
- `PATCH /api/v1/account/profile`
- `GET /api/v1/account/addresses`
- `POST /api/v1/account/addresses`
- `PATCH /api/v1/account/addresses/:addressId`
- `DELETE /api/v1/account/addresses/:addressId`
- `GET /api/v1/account/preferences`
- `PATCH /api/v1/account/preferences`
- `GET /api/v1/account/security/sessions`
- `DELETE /api/v1/account/security/sessions/:sessionId`

Key account response fields:
- profile summary
- order summary counts
- pending reviews count
- open support tickets count
- return/refund snapshot

## Catalog APIs

### Public catalog
- `GET /api/v1/catalog/products`
- `GET /api/v1/catalog/products/:productSlug`
- `GET /api/v1/catalog/categories`
- `GET /api/v1/catalog/categories/:categorySlug`
- `GET /api/v1/catalog/brands/:brandSlug`
- `GET /api/v1/catalog/search`
- `GET /api/v1/catalog/campaigns/:slug`
- `GET /api/v1/catalog/products/:productSlug/reviews`
- `GET /api/v1/catalog/products/:productSlug/questions`

Product detail contract should include:
- product core data
- media
- variants
- pricing
- eligibility to purchase
- stock/availability messaging state
- review summary
- related products
- support inquiry entry context

## Cart and checkout APIs

### Cart
- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `PATCH /api/v1/cart/items/:itemId`
- `DELETE /api/v1/cart/items/:itemId`
- `POST /api/v1/cart/apply-coupon`
- `DELETE /api/v1/cart/coupon`

### Checkout
- `POST /api/v1/checkout/validate`
- `POST /api/v1/checkout/create-order`
- `GET /api/v1/checkout/eligibility`
- `POST /api/v1/checkout/initialize-payment`

Checkout validation should return:
- normalized totals
- shipping options
- coupon outcome
- blocked items if any
- checkout eligibility state
- customer messaging for errors or warnings

## Orders, shipping, returns, and refunds APIs

### Customer order APIs
- `GET /api/v1/orders`
- `GET /api/v1/orders/:orderId`
- `GET /api/v1/orders/:orderId/tracking`
- `POST /api/v1/orders/:orderId/cancel-request`
- `POST /api/v1/orders/:orderId/return-request`
- `GET /api/v1/returns`
- `GET /api/v1/refunds`
- `POST /api/v1/track-order`

Order detail should include:
- order summary
- items
- payment state
- shipment state
- customer eligibility flags:
  - `canCancel`
  - `canReturn`
  - `canRequestRefund`
  - `canReviewItems`
  - `canOpenSupportTicket`

## Reviews and support APIs

### Reviews
- `GET /api/v1/reviews/me`
- `POST /api/v1/reviews`
- `PATCH /api/v1/reviews/:reviewId`
- `GET /api/v1/reviews/eligibility`

### Support
- `GET /api/v1/support`
- `POST /api/v1/support`
- `GET /api/v1/support/:ticketId`
- `POST /api/v1/support/:ticketId/messages`
- `POST /api/v1/support/:ticketId/attachments`

Support detail contract should include:
- ticket summary
- messages thread
- attachments
- linked order snapshot if present
- status
- allowed customer actions

## Content APIs
- `GET /api/v1/content/pages/:slug`
- `GET /api/v1/content/banners`
- `GET /api/v1/content/help`
- `GET /api/v1/content/contact`

## Admin auth and shell APIs
- `POST /api/v1/admin/auth/login`
- `POST /api/v1/admin/auth/logout`
- `GET /api/v1/admin/me`
- `GET /api/v1/admin/navigation`
- `GET /api/v1/admin/dashboard/overview`
- `GET /api/v1/admin/dashboard/sales`
- `GET /api/v1/admin/dashboard/operations`
- `GET /api/v1/admin/dashboard/support`
- `GET /api/v1/admin/dashboard/risk`
- `GET /api/v1/admin/dashboard/system-health`

`/admin/me` should return:
- profile
- roles
- permission codes
- session/security context
- UI feature flags if used

## Admin catalog APIs
- `GET /api/v1/admin/catalog/products`
- `POST /api/v1/admin/catalog/products`
- `GET /api/v1/admin/catalog/products/:productId`
- `PATCH /api/v1/admin/catalog/products/:productId`
- `POST /api/v1/admin/catalog/products/:productId/publish`
- `POST /api/v1/admin/catalog/products/:productId/unpublish`
- `POST /api/v1/admin/catalog/products/:productId/archive`
- `GET /api/v1/admin/catalog/products/:productId/analytics`
- `GET /api/v1/admin/catalog/products/:productId/activity`
- `GET /api/v1/admin/catalog/products/:productId/variants`
- `POST /api/v1/admin/catalog/products/:productId/variants`
- `PATCH /api/v1/admin/catalog/variants/:variantId`
- `GET /api/v1/admin/catalog/products/:productId/media`
- `POST /api/v1/admin/catalog/products/:productId/media`
- `DELETE /api/v1/admin/catalog/media/:mediaId`
- `GET /api/v1/admin/catalog/categories`
- `POST /api/v1/admin/catalog/categories`
- `PATCH /api/v1/admin/catalog/categories/:categoryId`
- `GET /api/v1/admin/catalog/brands`
- `POST /api/v1/admin/catalog/brands`
- `PATCH /api/v1/admin/catalog/brands/:brandId`
- `GET /api/v1/admin/catalog/reviews`
- `POST /api/v1/admin/catalog/reviews/:reviewId/moderate`

## Admin inventory APIs
- `GET /api/v1/admin/inventory/overview`
- `GET /api/v1/admin/inventory/low-stock`
- `GET /api/v1/admin/inventory/out-of-stock`
- `GET /api/v1/admin/inventory/movements`
- `POST /api/v1/admin/inventory/adjustments`
- `GET /api/v1/admin/inventory/warehouses`
- `POST /api/v1/admin/inventory/warehouses`
- `GET /api/v1/admin/inventory/warehouses/:warehouseId`
- `PATCH /api/v1/admin/inventory/warehouses/:warehouseId`

Adjustment request should support:
- warehouseId
- variantId
- quantityDelta
- reason
- note
- confirmationReason for high-risk changes if policy requires

## Admin order and fulfillment APIs
- `GET /api/v1/admin/orders`
- `GET /api/v1/admin/orders/:orderId`
- `GET /api/v1/admin/orders/:orderId/timeline`
- `POST /api/v1/admin/orders/:orderId/status`
- `POST /api/v1/admin/orders/:orderId/notes`
- `POST /api/v1/admin/orders/:orderId/cancel`
- `GET /api/v1/admin/orders/fulfillment-queue`
- `GET /api/v1/admin/orders/dispatch-queue`
- `POST /api/v1/admin/orders/:orderId/shipments`
- `GET /api/v1/admin/shipments/:shipmentId`
- `POST /api/v1/admin/shipments/:shipmentId/tracking-events`
- `GET /api/v1/admin/returns`
- `GET /api/v1/admin/returns/:returnId`
- `POST /api/v1/admin/returns/:returnId/approve`
- `POST /api/v1/admin/returns/:returnId/reject`
- `POST /api/v1/admin/returns/:returnId/mark-received`
- `GET /api/v1/admin/cancellations`

## Admin payments APIs
- `GET /api/v1/admin/payments`
- `GET /api/v1/admin/payments/:paymentId`
- `GET /api/v1/admin/payments/:paymentId/transactions`
- `GET /api/v1/admin/payments/failed`
- `GET /api/v1/admin/refunds`
- `GET /api/v1/admin/refunds/:refundId`
- `POST /api/v1/admin/refunds/:refundId/approve`
- `POST /api/v1/admin/refunds/:refundId/reject`
- `POST /api/v1/admin/refunds/:refundId/mark-completed`
- `GET /api/v1/admin/finance/exceptions`

## Admin customer APIs
- `GET /api/v1/admin/customers`
- `GET /api/v1/admin/customers/:customerId`
- `GET /api/v1/admin/customers/:customerId/activity`
- `GET /api/v1/admin/customers/:customerId/orders`
- `GET /api/v1/admin/customers/:customerId/support`
- `GET /api/v1/admin/customers/:customerId/reviews`
- `GET /api/v1/admin/customers/:customerId/risk`
- `POST /api/v1/admin/customers/:customerId/suspend`
- `POST /api/v1/admin/customers/:customerId/restore`
- `POST /api/v1/admin/customers/:customerId/notes`

## Admin support APIs
- `GET /api/v1/admin/support/tickets`
- `POST /api/v1/admin/support/tickets/:ticketId/assign`
- `POST /api/v1/admin/support/tickets/:ticketId/status`
- `GET /api/v1/admin/support/tickets/:ticketId`
- `POST /api/v1/admin/support/tickets/:ticketId/messages`
- `POST /api/v1/admin/support/tickets/:ticketId/internal-notes`
- `GET /api/v1/admin/support/queues/sla`
- `GET /api/v1/admin/support/queues/pre-purchase`
- `GET /api/v1/admin/support/queues/complaints`
- `GET /api/v1/admin/support/reports`

## Admin content and marketing APIs
- `GET /api/v1/admin/content/banners`
- `POST /api/v1/admin/content/banners`
- `PATCH /api/v1/admin/content/banners/:bannerId`
- `GET /api/v1/admin/content/pages`
- `POST /api/v1/admin/content/pages`
- `PATCH /api/v1/admin/content/pages/:pageId`
- `GET /api/v1/admin/marketing/coupons`
- `POST /api/v1/admin/marketing/coupons`
- `PATCH /api/v1/admin/marketing/coupons/:couponId`
- `GET /api/v1/admin/marketing/coupons/:couponId/analytics`
- `GET /api/v1/admin/marketing/promotions`
- `POST /api/v1/admin/marketing/promotions`
- `PATCH /api/v1/admin/marketing/promotions/:promotionId`
- `GET /api/v1/admin/marketing/promotions/:promotionId/rules`
- `GET /api/v1/admin/marketing/campaigns/performance`

## Admin reports APIs
- `GET /api/v1/admin/reports/overview`
- `GET /api/v1/admin/reports/sales`
- `GET /api/v1/admin/reports/products`
- `GET /api/v1/admin/reports/inventory`
- `GET /api/v1/admin/reports/customers`
- `GET /api/v1/admin/reports/support`
- `GET /api/v1/admin/reports/returns-refunds`
- `GET /api/v1/admin/reports/marketing`

## Admin security and audit APIs
- `GET /api/v1/admin/security/audit-logs`
- `GET /api/v1/admin/security/admin-action-logs`
- `GET /api/v1/admin/security/users/:userId/activity`
- `GET /api/v1/admin/security/alerts`
- `GET /api/v1/admin/security/alerts/:alertId`
- `POST /api/v1/admin/security/alerts/:alertId/acknowledge`
- `POST /api/v1/admin/security/alerts/:alertId/assign`
- `POST /api/v1/admin/security/alerts/:alertId/resolve`
- `GET /api/v1/admin/security/events`
- `GET /api/v1/admin/security/events/:eventId`
- `POST /api/v1/admin/security/events/:eventId/resolve`
- `GET /api/v1/admin/security/incidents`
- `GET /api/v1/admin/security/incidents/:incidentId`
- `POST /api/v1/admin/security/incidents`
- `POST /api/v1/admin/security/incidents/:incidentId/status`
- `POST /api/v1/admin/security/incidents/:incidentId/links`
- `GET /api/v1/admin/security/risk-signals`

## Admin system APIs
- `GET /api/v1/admin/system/settings`
- `PATCH /api/v1/admin/system/settings`
- `GET /api/v1/admin/system/webhooks`
- `GET /api/v1/admin/system/webhooks/:webhookEventId`
- `GET /api/v1/admin/system/jobs`
- `GET /api/v1/admin/system/jobs/:jobRunId`
- `GET /api/v1/admin/system/integrations/health`

## Mobile contract notes
Mobile mostly reuses customer endpoints. Add mobile-focused notes:
- support token refresh and 401 recovery
- support cached browsing data
- provide eligibility fields explicitly so app does not infer business rules
- return stable error codes for offline retry-safe flows

## Error code families
Recommended families:
- `AUTH_*`
- `VALIDATION_*`
- `PERMISSION_*`
- `CHECKOUT_*`
- `ORDER_*`
- `PAYMENT_*`
- `REFUND_*`
- `RETURN_*`
- `SUPPORT_*`
- `INVENTORY_*`
- `SECURITY_*`
- `SYSTEM_*`

## Implementation rules
- every list endpoint should define supported filters and sorting
- every detail endpoint should define eligibility/action flags where UI depends on them
- every sensitive admin mutation should create audit evidence
- every provider integration endpoint should be idempotent or replay-safe where required
- every mobile-sensitive endpoint should return predictable machine-readable states

## Final position
This API contract pack is the glue between the database architecture, backend modules, admin screens, customer web, and mobile app. It should be used as the implementation reference for controllers, validators, service methods, and frontend integration.
