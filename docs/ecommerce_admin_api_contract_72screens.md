# E-Commerce Admin API Contract

## Executive overview
This document defines the updated backend API contract for the **94-screen admin frontend**. It expands the earlier admin API scope to support deeper detail views, dedicated analytics pages, queue workflows, and governance screens.

The API is designed to support:
- a single-store commerce system now
- future multi-store integration later
- role-based route protection and action protection
- confirmation-backed mutations for sensitive operations
- high observability across commerce, support, finance, security, and system health

## API design principles
- use `/api/admin/...` namespace for admin routes
- separate list, detail, analytics, and queue endpoints when the frontend needs them independently
- separate approval or override endpoints from general update endpoints
- return timeline and activity data explicitly rather than forcing the frontend to reconstruct it
- preserve auditability by requiring actor context and reason fields for sensitive actions where policy demands them

## Authentication and session endpoints
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/forgot-password`
- `POST /api/admin/auth/reset-password`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`
- `GET /api/admin/auth/sessions`
- `POST /api/admin/auth/sessions/revoke-all`
- `POST /api/admin/auth/sessions/:sessionId/revoke`

## Dashboard endpoints
- `GET /api/admin/dashboard/overview`
- `GET /api/admin/dashboard/sales`
- `GET /api/admin/dashboard/operations`
- `GET /api/admin/dashboard/support`
- `GET /api/admin/dashboard/risk`
- `GET /api/admin/dashboard/system-health`
- `GET /api/admin/dashboard/recent-activity`

## Catalog endpoints
- `GET /api/admin/products`
- `POST /api/admin/products`
- `GET /api/admin/products/:productId`
- `PATCH /api/admin/products/:productId`
- `POST /api/admin/products/:productId/publish`
- `POST /api/admin/products/:productId/unpublish`
- `POST /api/admin/products/:productId/archive`
- `GET /api/admin/products/:productId/analytics`
- `GET /api/admin/products/:productId/variants`
- `POST /api/admin/products/:productId/variants`
- `PATCH /api/admin/products/:productId/variants/:variantId`
- `GET /api/admin/products/:productId/media`
- `POST /api/admin/products/:productId/media`
- `PATCH /api/admin/products/:productId/media/reorder`
- `DELETE /api/admin/products/:productId/media/:mediaId`
- `GET /api/admin/products/:productId/pricing`
- `PATCH /api/admin/products/:productId/pricing`
- `GET /api/admin/products/:productId/inventory-summary`
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:categoryId`
- `POST /api/admin/categories/:categoryId/archive`
- `GET /api/admin/brands`
- `POST /api/admin/brands`
- `PATCH /api/admin/brands/:brandId`
- `POST /api/admin/brands/:brandId/archive`
- `GET /api/admin/reviews`
- `GET /api/admin/reviews/:reviewId`
- `POST /api/admin/reviews/:reviewId/publish`
- `POST /api/admin/reviews/:reviewId/hide`
- `POST /api/admin/reviews/:reviewId/reject`

## Inventory endpoints
- `GET /api/admin/inventory/overview`
- `GET /api/admin/inventory/low-stock`
- `GET /api/admin/inventory/out-of-stock`
- `GET /api/admin/inventory/movements`
- `POST /api/admin/inventory/adjustments`
- `GET /api/admin/warehouses`
- `POST /api/admin/warehouses`
- `GET /api/admin/warehouses/:warehouseId`
- `PATCH /api/admin/warehouses/:warehouseId`
- `GET /api/admin/warehouses/:warehouseId/inventory`

## Orders and fulfillment endpoints
- `GET /api/admin/orders`
- `GET /api/admin/orders/:orderId`
- `GET /api/admin/orders/:orderId/timeline`
- `POST /api/admin/orders/:orderId/status`
- `POST /api/admin/orders/:orderId/cancel`
- `GET /api/admin/orders/fulfillment-queue`
- `GET /api/admin/orders/dispatch-queue`
- `POST /api/admin/orders/:orderId/assign-warehouse`
- `POST /api/admin/orders/:orderId/create-shipment`
- `GET /api/admin/shipments/:shipmentId`
- `PATCH /api/admin/shipments/:shipmentId`
- `GET /api/admin/shipments/:shipmentId/tracking`
- `POST /api/admin/shipments/:shipmentId/tracking`
- `GET /api/admin/returns`
- `GET /api/admin/returns/:returnId`
- `POST /api/admin/returns/:returnId/approve`
- `POST /api/admin/returns/:returnId/reject`
- `POST /api/admin/returns/:returnId/mark-received`
- `POST /api/admin/returns/:returnId/complete`
- `GET /api/admin/orders/cancellation-requests`
- `POST /api/admin/orders/cancellation-requests/:cancellationId/approve`
- `POST /api/admin/orders/cancellation-requests/:cancellationId/reject`

## Payments and finance endpoints
- `GET /api/admin/payments`
- `GET /api/admin/payments/:paymentId`
- `GET /api/admin/payments/:paymentId/transactions`
- `GET /api/admin/refunds`
- `GET /api/admin/refunds/:refundId`
- `POST /api/admin/refunds/:refundId/approve`
- `POST /api/admin/refunds/:refundId/reject`
- `POST /api/admin/refunds/:refundId/mark-completed`
- `GET /api/admin/payments/failed-investigations`
- `GET /api/admin/finance/exceptions`
- `POST /api/admin/finance/exceptions/:exceptionId/resolve`

## Customer endpoints
- `GET /api/admin/customers`
- `GET /api/admin/customers/:customerId`
- `GET /api/admin/customers/:customerId/activity`
- `GET /api/admin/customers/:customerId/orders`
- `GET /api/admin/customers/:customerId/support`
- `GET /api/admin/customers/:customerId/reviews`
- `GET /api/admin/customers/:customerId/risk`
- `POST /api/admin/customers/:customerId/suspend`
- `POST /api/admin/customers/:customerId/reactivate`
- `POST /api/admin/customers/:customerId/internal-actions`

## Support endpoints
- `GET /api/admin/support/tickets`
- `GET /api/admin/support/tickets/:ticketId`
- `POST /api/admin/support/tickets/:ticketId/reply`
- `POST /api/admin/support/tickets/:ticketId/internal-note`
- `POST /api/admin/support/tickets/:ticketId/assign`
- `POST /api/admin/support/tickets/:ticketId/status`
- `GET /api/admin/support/queue`
- `GET /api/admin/support/pre-purchase`
- `GET /api/admin/support/complaints`
- `GET /api/admin/support/analytics`

## Content and marketing endpoints
- `GET /api/admin/banners`
- `POST /api/admin/banners`
- `PATCH /api/admin/banners/:bannerId`
- `POST /api/admin/banners/:bannerId/publish`
- `POST /api/admin/banners/:bannerId/unpublish`
- `GET /api/admin/cms/pages`
- `POST /api/admin/cms/pages`
- `GET /api/admin/cms/pages/:pageId`
- `PATCH /api/admin/cms/pages/:pageId`
- `POST /api/admin/cms/pages/:pageId/publish`
- `GET /api/admin/coupons`
- `POST /api/admin/coupons`
- `PATCH /api/admin/coupons/:couponId`
- `POST /api/admin/coupons/:couponId/disable`
- `GET /api/admin/coupons/analytics`
- `GET /api/admin/promotions`
- `POST /api/admin/promotions`
- `GET /api/admin/promotions/:promotionId`
- `PATCH /api/admin/promotions/:promotionId`
- `GET /api/admin/promotions/:promotionId/rules`
- `POST /api/admin/promotions/:promotionId/rules`
- `PATCH /api/admin/promotions/:promotionId/rules/:ruleId`
- `GET /api/admin/campaigns/performance`

## Reporting endpoints
- `GET /api/admin/reports/overview`
- `GET /api/admin/reports/sales`
- `GET /api/admin/reports/products`
- `GET /api/admin/reports/inventory`
- `GET /api/admin/reports/customers`
- `GET /api/admin/reports/support`
- `GET /api/admin/reports/refunds-returns`
- `GET /api/admin/reports/marketing`

## Security and governance endpoints
- `GET /api/admin/audit-logs`
- `GET /api/admin/admin-action-logs`
- `GET /api/admin/user-activity`
- `GET /api/admin/alerts`
- `GET /api/admin/alerts/:alertId`
- `POST /api/admin/alerts/:alertId/acknowledge`
- `POST /api/admin/alerts/:alertId/assign`
- `POST /api/admin/alerts/:alertId/resolve`
- `GET /api/admin/security-events`
- `GET /api/admin/security-events/:securityEventId`
- `POST /api/admin/security-events/:securityEventId/status`
- `GET /api/admin/incidents`
- `POST /api/admin/incidents`
- `GET /api/admin/incidents/:incidentId`
- `PATCH /api/admin/incidents/:incidentId`
- `POST /api/admin/incidents/:incidentId/close`
- `GET /api/admin/risk-signals`

## System and observability endpoints
- `GET /api/admin/settings`
- `PATCH /api/admin/settings`
- `GET /api/admin/settings/checkout`
- `PATCH /api/admin/settings/checkout`
- `GET /api/admin/settings/reviews`
- `PATCH /api/admin/settings/reviews`
- `GET /api/admin/settings/support`
- `PATCH /api/admin/settings/support`
- `GET /api/admin/webhooks`
- `GET /api/admin/webhooks/:webhookEventId`
- `POST /api/admin/webhooks/:webhookEventId/retry`
- `GET /api/admin/jobs`
- `GET /api/admin/jobs/:jobRunId`
- `POST /api/admin/jobs/:jobRunId/retry`
- `GET /api/admin/integrations/health`
- `GET /api/admin/integrations/exceptions`

## Screen-to-endpoint mapping expectations

### Dedicated detail pages
The frontend should not overload list endpoints for detail views. Dedicated detail screens should call dedicated endpoints, for example:
- product detail -> `/api/admin/products/:productId`
- product analytics -> `/api/admin/products/:productId/analytics`
- order timeline -> `/api/admin/orders/:orderId/timeline`
- payment transactions -> `/api/admin/payments/:paymentId/transactions`
- customer risk -> `/api/admin/customers/:customerId/risk`
- alert detail -> `/api/admin/alerts/:alertId`
- security event detail -> `/api/admin/security-events/:securityEventId`
- incident detail -> `/api/admin/incidents/:incidentId`

### Queue pages
Queue screens should usually have dedicated endpoints rather than being treated as filtered variants of generic list pages. This helps the backend optimize by business rule and lets the frontend implement queue-specific counts and summaries.

## Sensitive mutation patterns
Sensitive endpoints should support request bodies with fields such as:
- `reason`
- `note`
- `expected_version` later if optimistic concurrency is used
- `source_screen` later if audit telemetry wants UI origin context

Examples:
- cancel order
- approve refund
- adjust inventory
- suspend customer
- publish product
- edit pricing
- resolve alert
- close incident
- update sensitive settings

## Response design expectations
List endpoints should usually support:
- `items`
- `page`
- `page_size`
- `total`
- `applied_filters`
- optional summary counts for queue pages

Detail endpoints should usually support:
- `entity`
- `related_entities`
- `timeline`
- `available_actions`
- `permission_hints` if the frontend uses action gating from backend metadata

## Final contract position
This contract is now aligned to the **94-screen admin scope** and gives the backend a route-level blueprint for:
- operational control
- deep detail pages
- analytics views
- queue views
- investigation and governance workspaces
- system health and integration monitoring
