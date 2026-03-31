export type AdminHttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type AdminEndpointModule =
  | "platform"
  | "auth"
  | "dashboard"
  | "catalog"
  | "inventory"
  | "orders"
  | "payments"
  | "customers"
  | "support"
  | "content"
  | "marketing"
  | "reports"
  | "security"
  | "system";

export type AdminEndpointDefinition = {
  id: string;
  module: AdminEndpointModule;
  method: AdminHttpMethod;
  path: string;
  purpose: string;
};

const endpoint = (
  id: string,
  module: AdminEndpointModule,
  method: AdminHttpMethod,
  path: string,
  purpose: string
): AdminEndpointDefinition => ({
  id,
  module,
  method,
  path,
  purpose
});

export const adminEndpointCatalog = [
  endpoint("platform.clientConfig", "platform", "GET", "/api/client-config/admin", "Load runtime config for the admin app."),

  endpoint("auth.login", "auth", "POST", "/api/admin/auth/login", "Authenticate an admin and create API session tokens."),
  endpoint("auth.refresh", "auth", "POST", "/api/admin/auth/refresh", "Rotate an admin access token."),
  endpoint("auth.forgotPassword", "auth", "POST", "/api/admin/auth/forgot-password", "Send an admin password reset email."),
  endpoint("auth.resetPassword", "auth", "POST", "/api/admin/auth/reset-password", "Complete the admin password reset flow."),
  endpoint("auth.logout", "auth", "POST", "/api/admin/auth/logout", "Revoke the current admin API session."),
  endpoint("auth.me", "auth", "GET", "/api/admin/auth/me", "Load the current admin shell context, roles, and permissions."),
  endpoint("auth.sessions", "auth", "GET", "/api/admin/auth/sessions", "List visible admin sessions."),
  endpoint("auth.revokeAll", "auth", "POST", "/api/admin/auth/sessions/revoke-all", "Revoke all other admin sessions."),
  endpoint("auth.revokeSession", "auth", "POST", "/api/admin/auth/sessions/:sessionId/revoke", "Revoke a single admin session."),

  endpoint("dashboard.overview", "dashboard", "GET", "/api/admin/dashboard/overview", "Load the executive dashboard overview."),
  endpoint("dashboard.sales", "dashboard", "GET", "/api/admin/reports/sales", "Load the sales dashboard."),
  endpoint("dashboard.operations", "dashboard", "GET", "/api/admin/reports/inventory", "Load the operations dashboard."),
  endpoint("dashboard.support", "dashboard", "GET", "/api/admin/dashboard/support", "Load the support dashboard."),
  endpoint("dashboard.risk", "dashboard", "GET", "/api/admin/security/dashboard", "Load the risk dashboard."),
  endpoint("dashboard.systemHealth", "dashboard", "GET", "/api/admin/dashboard/system-health", "Load the system health dashboard."),
  endpoint("dashboard.recentActivity", "dashboard", "GET", "/api/admin/dashboard/recent-activity", "Load recent operational activity for dashboard surfaces."),

  endpoint("catalog.products.list", "catalog", "GET", "/api/admin/catalog/products", "List products for admin catalog management."),
  endpoint("catalog.products.create", "catalog", "POST", "/api/admin/catalog/products", "Create a product."),
  endpoint("catalog.products.detail", "catalog", "GET", "/api/admin/catalog/products/:productId", "Load product detail."),
  endpoint("catalog.products.update", "catalog", "PATCH", "/api/admin/catalog/products/:productId", "Update product fields."),
  endpoint("catalog.products.publish", "catalog", "POST", "/api/admin/catalog/products/:productId/publish", "Publish a product."),
  endpoint("catalog.products.unpublish", "catalog", "POST", "/api/admin/catalog/products/:productId/unpublish", "Unpublish a product."),
  endpoint("catalog.products.archive", "catalog", "POST", "/api/admin/catalog/products/:productId/archive", "Archive a product."),
  endpoint("catalog.products.analytics", "catalog", "GET", "/api/admin/catalog/products/:productId/analytics", "Load product analytics."),
  endpoint("catalog.products.activity", "catalog", "GET", "/api/admin/catalog/products/:productId/activity", "Load product activity."),
  endpoint("catalog.variants.list", "catalog", "GET", "/api/admin/catalog/products/:productId/variants", "List product variants."),
  endpoint("catalog.variants.create", "catalog", "POST", "/api/admin/catalog/products/:productId/variants", "Create a product variant."),
  endpoint("catalog.variants.update", "catalog", "PATCH", "/api/admin/catalog/variants/:variantId", "Update a product variant."),
  endpoint("catalog.media.list", "catalog", "GET", "/api/admin/catalog/products/:productId/media", "List product media."),
  endpoint("catalog.media.uploadIntent", "catalog", "POST", "/api/admin/catalog/products/:productId/media/upload-intents", "Create a signed upload intent for product media."),
  endpoint("catalog.media.create", "catalog", "POST", "/api/admin/catalog/products/:productId/media", "Persist uploaded product media metadata."),
  endpoint("catalog.media.reorder", "catalog", "PATCH", "/api/admin/catalog/products/:productId/media/reorder", "Reorder product media."),
  endpoint("catalog.media.patch", "catalog", "PATCH", "/api/admin/catalog/media/:mediaId", "Update product media metadata (e.g. variant assignment)."),
  endpoint("catalog.media.delete", "catalog", "DELETE", "/api/admin/catalog/media/:mediaId", "Delete product media."),
  endpoint("catalog.pricing.detail", "catalog", "GET", "/api/admin/catalog/products/:productId/pricing", "Load product pricing configuration."),
  endpoint("catalog.pricing.update", "catalog", "PATCH", "/api/admin/catalog/products/:productId/pricing", "Update product pricing."),
  endpoint("catalog.inventorySummary", "catalog", "GET", "/api/admin/catalog/products/:productId/inventory-summary", "Load product inventory summary."),
  endpoint("catalog.categories.list", "catalog", "GET", "/api/admin/catalog/categories", "List product categories."),
  endpoint("catalog.categories.detail", "catalog", "GET", "/api/admin/catalog/categories/:categoryId", "Get one category (list row shape)."),
  endpoint("catalog.categories.create", "catalog", "POST", "/api/admin/catalog/categories", "Create a category."),
  endpoint("catalog.categories.update", "catalog", "PATCH", "/api/admin/catalog/categories/:categoryId", "Update a category."),
  endpoint("catalog.categories.archive", "catalog", "POST", "/api/admin/catalog/categories/:categoryId/archive", "Archive a category."),
  endpoint("catalog.brands.list", "catalog", "GET", "/api/admin/catalog/brands", "List brands."),
  endpoint("catalog.brands.detail", "catalog", "GET", "/api/admin/catalog/brands/:brandId", "Get one brand (list row shape)."),
  endpoint("catalog.brands.create", "catalog", "POST", "/api/admin/catalog/brands", "Create a brand."),
  endpoint("catalog.brands.update", "catalog", "PATCH", "/api/admin/catalog/brands/:brandId", "Update a brand."),
  endpoint("catalog.brands.archive", "catalog", "POST", "/api/admin/catalog/brands/:brandId/archive", "Archive a brand."),
  endpoint("catalog.reviews.list", "catalog", "GET", "/api/admin/catalog/reviews", "List reviews for moderation."),
  endpoint("catalog.reviews.detail", "catalog", "GET", "/api/admin/catalog/reviews/:reviewId", "Load review detail."),
  endpoint("catalog.reviews.moderate", "catalog", "POST", "/api/admin/catalog/reviews/:reviewId/moderate", "Moderate a review."),

  endpoint("inventory.overview", "inventory", "GET", "/api/admin/inventory/overview", "Load inventory overview."),
  endpoint("inventory.lowStock", "inventory", "GET", "/api/admin/inventory/low-stock", "Load low-stock queue."),
  endpoint("inventory.outOfStock", "inventory", "GET", "/api/admin/inventory/out-of-stock", "Load out-of-stock queue."),
  endpoint("inventory.movements", "inventory", "GET", "/api/admin/inventory/movements", "Load inventory movement history."),
  endpoint("inventory.adjustments.create", "inventory", "POST", "/api/admin/inventory/adjustments", "Create a manual inventory adjustment."),
  endpoint("inventory.warehouses.list", "inventory", "GET", "/api/admin/inventory/warehouses", "List warehouses."),
  endpoint("inventory.warehouses.create", "inventory", "POST", "/api/admin/inventory/warehouses", "Create a warehouse."),
  endpoint("inventory.warehouses.detail", "inventory", "GET", "/api/admin/inventory/warehouses/:warehouseId", "Load warehouse detail."),
  endpoint("inventory.warehouses.update", "inventory", "PATCH", "/api/admin/inventory/warehouses/:warehouseId", "Update a warehouse."),
  endpoint("inventory.warehouses.inventory", "inventory", "GET", "/api/admin/inventory/warehouses/:warehouseId/inventory", "Load warehouse inventory detail."),

  endpoint("orders.list", "orders", "GET", "/api/admin/orders", "List orders."),
  endpoint("orders.fulfillmentQueue", "orders", "GET", "/api/admin/orders/fulfillment-queue", "Load orders awaiting fulfillment."),
  endpoint("orders.dispatchQueue", "orders", "GET", "/api/admin/orders/dispatch-queue", "Load orders awaiting dispatch."),
  endpoint("orders.detail", "orders", "GET", "/api/admin/orders/:orderId", "Load order detail."),
  endpoint("orders.timeline", "orders", "GET", "/api/admin/orders/:orderId/timeline", "Load order timeline."),
  endpoint("orders.updateStatus", "orders", "POST", "/api/admin/orders/:orderId/status", "Update order status."),
  endpoint("orders.assignWarehouse", "orders", "POST", "/api/admin/orders/:orderId/assign-warehouse", "Assign a warehouse to an order."),
  endpoint("orders.cancel", "orders", "POST", "/api/admin/orders/:orderId/cancel", "Cancel an order."),
  endpoint("orders.cancellationRequests", "orders", "GET", "/api/admin/orders/cancellation-requests", "Load the order cancellation request queue."),
  endpoint("orders.cancellationApprove", "orders", "POST", "/api/admin/orders/cancellation-requests/:cancellationId/approve", "Approve an order cancellation request."),
  endpoint("orders.cancellationReject", "orders", "POST", "/api/admin/orders/cancellation-requests/:cancellationId/reject", "Reject an order cancellation request."),
  endpoint("shipments.create", "orders", "POST", "/api/admin/orders/:orderId/shipments", "Create a shipment for an order."),
  endpoint("shipments.detail", "orders", "GET", "/api/admin/shipments/:shipmentId", "Load shipment detail."),
  endpoint("shipments.update", "orders", "PATCH", "/api/admin/shipments/:shipmentId", "Update shipment fields."),
  endpoint("shipments.tracking", "orders", "GET", "/api/admin/shipments/:shipmentId/tracking", "Load shipment tracking events."),
  endpoint("shipments.trackingCreate", "orders", "POST", "/api/admin/shipments/:shipmentId/tracking-events", "Append a shipment tracking event."),
  endpoint("returns.list", "orders", "GET", "/api/admin/returns", "Load the returns queue."),
  endpoint("returns.detail", "orders", "GET", "/api/admin/returns/:returnId", "Load return detail."),
  endpoint("returns.approve", "orders", "POST", "/api/admin/returns/:returnId/approve", "Approve a return."),
  endpoint("returns.reject", "orders", "POST", "/api/admin/returns/:returnId/reject", "Reject a return."),
  endpoint("returns.markReceived", "orders", "POST", "/api/admin/returns/:returnId/mark-received", "Mark a return as received."),
  endpoint("returns.complete", "orders", "POST", "/api/admin/returns/:returnId/complete", "Complete a return."),

  endpoint("payments.list", "payments", "GET", "/api/admin/payments", "Load the payments list."),
  endpoint("payments.failedInvestigations", "payments", "GET", "/api/admin/payments/failed-investigations", "Load failed payment investigations."),
  endpoint("payments.detail", "payments", "GET", "/api/admin/payments/:paymentId", "Load payment detail."),
  endpoint("payments.transactions", "payments", "GET", "/api/admin/payments/:paymentId/transactions", "Load payment transaction history."),
  endpoint("refunds.list", "payments", "GET", "/api/admin/refunds", "Load the refunds queue."),
  endpoint("refunds.detail", "payments", "GET", "/api/admin/refunds/:refundId", "Load refund detail."),
  endpoint("refunds.approve", "payments", "POST", "/api/admin/refunds/:refundId/approve", "Approve a refund."),
  endpoint("refunds.reject", "payments", "POST", "/api/admin/refunds/:refundId/reject", "Reject a refund."),
  endpoint("refunds.markCompleted", "payments", "POST", "/api/admin/refunds/:refundId/mark-completed", "Mark a refund as completed."),
  endpoint("finance.exceptions", "payments", "GET", "/api/admin/finance/exceptions", "Load finance exceptions."),
  endpoint("finance.resolveException", "payments", "POST", "/api/admin/finance/exceptions/:exceptionId/resolve", "Resolve a finance exception."),

  endpoint("customers.list", "customers", "GET", "/api/admin/customers", "Load customers."),
  endpoint("customers.detail", "customers", "GET", "/api/admin/customers/:customerId", "Load customer detail."),
  endpoint("customers.activity", "customers", "GET", "/api/admin/customers/:customerId/activity", "Load customer activity timeline."),
  endpoint("customers.orders", "customers", "GET", "/api/admin/customers/:customerId/orders", "Load customer orders."),
  endpoint("customers.support", "customers", "GET", "/api/admin/customers/:customerId/support", "Load customer support history."),
  endpoint("customers.reviews", "customers", "GET", "/api/admin/customers/:customerId/reviews", "Load customer reviews."),
  endpoint("customers.risk", "customers", "GET", "/api/admin/customers/:customerId/risk", "Load customer risk profile."),
  endpoint("customers.suspend", "customers", "POST", "/api/admin/customers/:customerId/suspend", "Suspend a customer."),
  endpoint("customers.reactivate", "customers", "POST", "/api/admin/customers/:customerId/reactivate", "Reactivate a customer."),
  endpoint("customers.restore", "customers", "POST", "/api/admin/customers/:customerId/restore", "Restore a customer from a suspended or inactive state."),
  endpoint("customers.notes", "customers", "POST", "/api/admin/customers/:customerId/notes", "Create a customer internal note."),
  endpoint("customers.internalActions", "customers", "POST", "/api/admin/customers/:customerId/internal-actions", "Record a customer internal action."),

  endpoint("support.tickets.list", "support", "GET", "/api/admin/support/tickets", "Load support tickets."),
  endpoint("support.tickets.bulkAssign", "support", "POST", "/api/admin/support/tickets/bulk-assign", "Bulk assign support tickets."),
  endpoint("support.tickets.bulkStatus", "support", "POST", "/api/admin/support/tickets/bulk-status", "Bulk update support ticket status."),
  endpoint("support.tickets.detail", "support", "GET", "/api/admin/support/tickets/:ticketId", "Load support ticket detail."),
  endpoint("support.tickets.assign", "support", "POST", "/api/admin/support/tickets/:ticketId/assign", "Assign a support ticket."),
  endpoint("support.tickets.status", "support", "POST", "/api/admin/support/tickets/:ticketId/status", "Update support ticket status."),
  endpoint("support.tickets.reply", "support", "POST", "/api/admin/support/tickets/:ticketId/messages", "Reply to a support ticket."),
  endpoint("support.tickets.internalNote", "support", "POST", "/api/admin/support/tickets/:ticketId/internal-notes", "Add an internal note to a support ticket."),
  endpoint("support.queues.sla", "support", "GET", "/api/admin/support/queues/sla", "Load the SLA-priority support queue."),
  endpoint("support.queues.prePurchase", "support", "GET", "/api/admin/support/queues/pre-purchase", "Load the pre-purchase support queue."),
  endpoint("support.queues.complaints", "support", "GET", "/api/admin/support/queues/complaints", "Load the complaints queue."),
  endpoint("support.reports", "support", "GET", "/api/admin/support/reports", "Load support analytics."),

  endpoint("content.pages.list", "content", "GET", "/api/admin/content/pages", "Load CMS pages."),
  endpoint("content.pages.create", "content", "POST", "/api/admin/content/pages", "Create a CMS page."),
  endpoint("content.pages.detail", "content", "GET", "/api/admin/content/pages/:pageId", "Load CMS page detail."),
  endpoint("content.pages.update", "content", "PATCH", "/api/admin/content/pages/:pageId", "Update a CMS page."),
  endpoint("content.pages.publish", "content", "POST", "/api/admin/content/pages/:pageId/publish", "Publish a CMS page."),
  endpoint("content.banners.list", "content", "GET", "/api/admin/content/banners", "Load banners."),
  endpoint("content.media.uploadIntent", "content", "POST", "/api/admin/content/media/upload-intents", "Create a signed upload intent for content media."),
  endpoint("content.banners.create", "content", "POST", "/api/admin/content/banners", "Create a banner."),
  endpoint("content.banners.update", "content", "PATCH", "/api/admin/content/banners/:bannerId", "Update a banner."),
  endpoint("content.banners.publish", "content", "POST", "/api/admin/content/banners/:bannerId/publish", "Publish a banner."),
  endpoint("content.banners.unpublish", "content", "POST", "/api/admin/content/banners/:bannerId/unpublish", "Unpublish a banner."),
  endpoint("content.banners.delete", "content", "DELETE", "/api/admin/content/banners/:bannerId", "Delete a banner."),

  endpoint("marketing.coupons.list", "marketing", "GET", "/api/admin/marketing/coupons", "Load coupons."),
  endpoint("marketing.coupons.create", "marketing", "POST", "/api/admin/marketing/coupons", "Create a coupon."),
  endpoint("marketing.coupons.update", "marketing", "PATCH", "/api/admin/marketing/coupons/:couponId", "Update a coupon."),
  endpoint("marketing.promotions.list", "marketing", "GET", "/api/admin/marketing/promotions", "Load promotions."),
  endpoint("marketing.promotions.create", "marketing", "POST", "/api/admin/marketing/promotions", "Create a promotion."),
  endpoint("marketing.promotions.detail", "marketing", "GET", "/api/admin/marketing/promotions/:promotionId", "Load promotion detail."),
  endpoint("marketing.promotions.update", "marketing", "PATCH", "/api/admin/marketing/promotions/:promotionId", "Update a promotion."),
  endpoint("marketing.campaigns.list", "marketing", "GET", "/api/admin/marketing/campaigns", "Load campaigns."),
  endpoint("marketing.campaigns.create", "marketing", "POST", "/api/admin/marketing/campaigns", "Create a campaign."),
  endpoint("marketing.campaigns.detail", "marketing", "GET", "/api/admin/marketing/campaigns/:campaignId", "Load campaign detail."),
  endpoint("marketing.campaigns.update", "marketing", "PATCH", "/api/admin/marketing/campaigns/:campaignId", "Update a campaign."),
  endpoint("marketing.contract.coupons.list", "marketing", "GET", "/api/admin/coupons", "Load coupon compatibility contract endpoints."),
  endpoint("marketing.contract.coupons.create", "marketing", "POST", "/api/admin/coupons", "Create a coupon via compatibility endpoint."),
  endpoint("marketing.contract.coupons.update", "marketing", "PATCH", "/api/admin/coupons/:couponId", "Update a coupon via compatibility endpoint."),
  endpoint("marketing.contract.coupons.disable", "marketing", "POST", "/api/admin/coupons/:couponId/disable", "Disable a coupon."),
  endpoint("marketing.contract.coupons.analytics", "marketing", "GET", "/api/admin/coupons/analytics", "Load coupon analytics."),
  endpoint("marketing.contract.promotions.list", "marketing", "GET", "/api/admin/promotions", "Load promotions via compatibility endpoint."),
  endpoint("marketing.contract.promotions.create", "marketing", "POST", "/api/admin/promotions", "Create a promotion via compatibility endpoint."),
  endpoint("marketing.contract.promotions.detail", "marketing", "GET", "/api/admin/promotions/:promotionId", "Load promotion detail via compatibility endpoint."),
  endpoint("marketing.contract.promotions.update", "marketing", "PATCH", "/api/admin/promotions/:promotionId", "Update promotion via compatibility endpoint."),
  endpoint("marketing.contract.promotions.rules.list", "marketing", "GET", "/api/admin/promotions/:promotionId/rules", "Load promotion rules."),
  endpoint("marketing.contract.promotions.rules.create", "marketing", "POST", "/api/admin/promotions/:promotionId/rules", "Create a promotion rule."),
  endpoint("marketing.contract.promotions.rules.update", "marketing", "PATCH", "/api/admin/promotions/:promotionId/rules/:ruleId", "Update a promotion rule."),
  endpoint("marketing.contract.campaignPerformance", "marketing", "GET", "/api/admin/campaigns/performance", "Load campaign performance analytics."),

  endpoint("reports.overview", "reports", "GET", "/api/admin/reports/overview", "Load reports overview."),
  endpoint("reports.dashboard", "reports", "GET", "/api/admin/reports/dashboard", "Load dashboard-grade report aggregates."),
  endpoint("reports.sales", "reports", "GET", "/api/admin/reports/sales", "Load sales report."),
  endpoint("reports.inventory", "reports", "GET", "/api/admin/reports/inventory", "Load inventory report."),
  endpoint("reports.products", "reports", "GET", "/api/admin/reports/products", "Load products report."),
  endpoint("reports.customers", "reports", "GET", "/api/admin/reports/customers", "Load customers report."),
  endpoint("reports.support", "reports", "GET", "/api/admin/reports/support", "Load support report."),
  endpoint("reports.refundsReturns", "reports", "GET", "/api/admin/reports/refunds-returns", "Load refunds and returns report."),
  endpoint("reports.postPurchase", "reports", "GET", "/api/admin/reports/post-purchase", "Load post-purchase report."),
  endpoint("reports.marketing", "reports", "GET", "/api/admin/reports/marketing", "Load marketing report."),

  endpoint("security.dashboard", "security", "GET", "/api/admin/security/dashboard", "Load the security dashboard."),
  endpoint("security.auditLogs", "security", "GET", "/api/admin/audit-logs", "Load audit logs."),
  endpoint("security.adminActionLogs", "security", "GET", "/api/admin/admin-action-logs", "Load admin action logs."),
  endpoint("security.userActivity", "security", "GET", "/api/admin/user-activity", "Load user-facing activity explorer data."),
  endpoint("security.alerts.list", "security", "GET", "/api/admin/alerts", "Load alerts."),
  endpoint("security.alerts.detail", "security", "GET", "/api/admin/alerts/:alertId", "Load alert detail."),
  endpoint("security.alerts.assign", "security", "POST", "/api/admin/alerts/:alertId/assign", "Assign an alert."),
  endpoint("security.alerts.acknowledge", "security", "POST", "/api/admin/alerts/:alertId/acknowledge", "Acknowledge an alert."),
  endpoint("security.alerts.resolve", "security", "POST", "/api/admin/alerts/:alertId/resolve", "Resolve an alert."),
  endpoint("security.alerts.bulkAcknowledge", "security", "POST", "/api/admin/alerts/bulk-acknowledge", "Acknowledge multiple alerts."),
  endpoint("security.alerts.bulkAssign", "security", "POST", "/api/admin/alerts/bulk-assign", "Assign multiple alerts."),
  endpoint("security.events.list", "security", "GET", "/api/admin/security-events", "Load security events."),
  endpoint("security.events.detail", "security", "GET", "/api/admin/security-events/:eventId", "Load security event detail."),
  endpoint("security.events.status", "security", "POST", "/api/admin/security-events/:eventId/status", "Update security event status."),
  endpoint("security.events.notify", "security", "POST", "/api/admin/security-events/:eventId/notify", "Create follow-up alert for a security event."),
  endpoint("security.events.requestIpBlock", "security", "POST", "/api/admin/security-events/:eventId/request-ip-block", "Record IP block request on event metadata."),
  endpoint("security.incidents.list", "security", "GET", "/api/admin/incidents", "Load incidents."),
  endpoint("security.incidents.create", "security", "POST", "/api/admin/incidents", "Create an incident."),
  endpoint("security.incidents.detail", "security", "GET", "/api/admin/incidents/:incidentId", "Load incident detail."),
  endpoint("security.incidents.update", "security", "PATCH", "/api/admin/incidents/:incidentId", "Update an incident."),
  endpoint("security.incidents.close", "security", "POST", "/api/admin/incidents/:incidentId/close", "Close an incident."),
  endpoint("security.riskSignals", "security", "GET", "/api/admin/risk-signals", "Load risk signals."),
  endpoint("security.riskSignals.review", "security", "POST", "/api/admin/security/risk-signals/:riskSignalId/review", "Review a risk signal."),
  endpoint("security.riskSignals.reviewPlain", "security", "POST", "/api/admin/risk-signals/:riskSignalId/review", "Review or escalate a risk signal (plain contract)."),
  endpoint("security.loginEvents", "security", "GET", "/api/admin/security/login-events", "Load login and access security events."),

  endpoint("system.settings.detail", "system", "GET", "/api/admin/settings", "Load system settings overview."),
  endpoint("system.settings.update", "system", "PATCH", "/api/admin/settings", "Update system settings overview."),
  endpoint("system.settings.checkoutDetail", "system", "GET", "/api/admin/settings/checkout", "Load checkout settings."),
  endpoint("system.settings.checkoutUpdate", "system", "PATCH", "/api/admin/settings/checkout", "Update checkout settings."),
  endpoint("system.settings.reviewDetail", "system", "GET", "/api/admin/settings/reviews", "Load review settings."),
  endpoint("system.settings.supportDetail", "system", "GET", "/api/admin/settings/support", "Load support settings."),
  endpoint("system.webhooks.list", "system", "GET", "/api/admin/webhooks", "Load webhook events."),
  endpoint("system.webhooks.detail", "system", "GET", "/api/admin/webhooks/:webhookEventId", "Load webhook event detail."),
  endpoint("system.webhooks.retry", "system", "POST", "/api/admin/webhooks/:webhookEventId/retry", "Retry webhook processing."),
  endpoint("system.jobs.list", "system", "GET", "/api/admin/jobs", "Load job runs."),
  endpoint("system.jobs.detail", "system", "GET", "/api/admin/jobs/:jobRunId", "Load job run detail."),
  endpoint("system.jobs.retry", "system", "POST", "/api/admin/jobs/:jobRunId/retry", "Retry a job run."),
  endpoint("system.integrations.health", "system", "GET", "/api/admin/integrations/health", "Load integration health."),
  endpoint("system.integrations.providers", "system", "GET", "/api/admin/integrations/providers", "Load provider integration state."),
  endpoint("system.integrations.exceptions", "system", "GET", "/api/admin/integrations/exceptions", "Load integration exceptions."),
  endpoint("system.notifications.list", "system", "GET", "/api/admin/notifications", "Load notification delivery records."),
  endpoint("system.notifications.detail", "system", "GET", "/api/admin/notifications/:notificationId", "Load notification detail."),
  endpoint("system.notifications.create", "system", "POST", "/api/admin/notifications", "Create a manual admin notification."),
  endpoint("system.notifications.retry", "system", "POST", "/api/admin/notifications/:notificationId/retry", "Retry a notification delivery.")
] as const satisfies readonly AdminEndpointDefinition[];

export const adminEndpointLookup = Object.fromEntries(
  adminEndpointCatalog.map((item) => [item.id, item])
) as Record<(typeof adminEndpointCatalog)[number]["id"], (typeof adminEndpointCatalog)[number]>;

export const adminEndpointModules = Array.from(
  new Set(adminEndpointCatalog.map((item) => item.module))
) as AdminEndpointModule[];
