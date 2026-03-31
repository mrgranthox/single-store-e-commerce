/**
 * Maps `AdminScreenDefinition.id` (kebab-case) → Stitch export folder under
 * `docs/admin frontend UI /stitch/<slug>/` (snake_case).
 * Keep in sync when adding screens or re-exporting from Stitch.
 */
export const stitchExportSlugByScreenId: Record<string, string> = {
  "admin-login": "admin_login",
  "admin-forgot-password": "forgot_password",
  "admin-reset-password": "reset_password",
  "admin-forbidden": "unauthorized",
  "admin-profile-security": "profile_security",
  "dashboard-overview": "executive_overview",
  "dashboard-sales": "sales_performance",
  "dashboard-operations": "operations_control",
  "dashboard-support": "customer_service",
  "dashboard-risk": "risk_security",
  "dashboard-system-health": "system_health_dashboard",
  "catalog-product-list": "product_list",
  "catalog-product-create": "create_product",
  "catalog-product-edit": "product_edit",
  "catalog-product-detail": "product_detail_overview",
  "catalog-product-analytics": "product_analytics_detail",
  "catalog-product-variants": "product_variants_management",
  "catalog-product-media": "product_media_management",
  "catalog-product-pricing": "product_pricing_merchandising",
  "catalog-product-inventory": "product_inventory_summary",
  "catalog-categories": "category_management",
  "catalog-category-new": "category_management",
  "catalog-category-edit": "category_management",
  "catalog-brands": "brand_management",
  "catalog-brand-new": "brand_management",
  "catalog-brand-edit": "brand_management",
  "catalog-reviews": "reviews_moderation",
  "inventory-overview": "inventory_overview",
  "inventory-low-stock": "low_stock_queue",
  "inventory-out-of-stock": "out_of_stock_queue",
  "inventory-movements": "movement_history",
  "inventory-adjustments": "inventory_adjustment_console",
  "inventory-warehouses": "warehouse_list",
  "inventory-warehouse-detail": "warehouse_detail",
  "inventory-warehouse-stock": "warehouse_inventory_detail",
  "orders-list": "orders_list",
  "orders-detail": "order_detail",
  "orders-timeline": "order_timeline_detail",
  "orders-fulfillment-queue": "fulfillment_queue",
  "orders-dispatch-queue": "dispatch_queue",
  "shipments-hub": "shipment_detail",
  "shipments-detail": "shipment_detail",
  "shipments-tracking": "shipment_tracking_events",
  "returns-queue": "returns_queue",
  "returns-detail": "return_detail",
  "orders-cancellation-requests": "cancellation_requests_queue",
  "payments-list": "payments_list",
  "payments-detail": "payment_detail",
  "payments-transactions": "payment_transaction_timeline",
  "refunds-queue": "refunds_queue",
  "refunds-detail": "refund_detail",
  "payments-failed-investigations": "failed_payments_investigation",
  "finance-exceptions": "financial_exceptions_reconciliation",
  "customers-list": "customers_list",
  "customers-detail": "customer_detail_overview",
  "customers-activity": "customer_activity_timeline",
  "customers-orders": "customer_orders_history",
  "customers-support": "customer_support_history",
  "customers-reviews": "customer_reviews_history",
  "customers-risk": "customer_risk_profile",
  "customers-actions": "customer_account_action_center",
  "support-tickets": "support_tickets_list",
  "support-ticket-detail": "support_ticket_detail",
  "support-sla-queue": "support_queue_by_sla",
  "support-pre-purchase": "pre_purchase_inquiries_queue",
  "support-complaints": "complaints_queue",
  "support-analytics": "support_analytics",
  "content-banners": "banners_management",
  "content-pages": "cms_pages_management",
  "marketing-coupons": "coupon_management",
  "marketing-coupon-analytics": "coupon_redemption_analytics",
  "marketing-promotions": "promotions_management",
  "marketing-promotion-rules-hub": "promotion_rules_detail",
  "marketing-promotion-rules": "promotion_rules_detail",
  "marketing-campaign-performance": "campaign_performance_overview",
  "reports-overview": "reports_overview",
  "reports-sales": "sales_analytics_report",
  "reports-products": "product_performance_analytics",
  "reports-inventory": "inventory_analytics_report",
  "reports-customers": "customer_analytics_report",
  "reports-support": "support_analytics_report",
  "reports-refunds-returns": "refunds_returns_report",
  "reports-marketing": "marketing_coupon_analytics",
  "security-audit-logs": "audit_logs_explorer",
  "security-admin-actions": "admin_action_logs_explorer",
  "security-user-activity": "user_activity_explorer",
  "security-alerts": "alerts_center",
  "security-alert-detail": "alert_detail",
  "security-events": "security_events_explorer",
  "security-event-detail": "security_event_detail",
  "security-incidents": "incidents_list",
  "security-incident-detail": "incident_investigation_workspace",
  "security-risk-signals": "risk_signals_fraud_review",
  "system-settings": "settings_overview_hub",
  "system-settings-checkout": "checkout_commerce_settings",
  "system-settings-reviews": "review_moderation_settings",
  "system-settings-support": "support_sla_settings",
  "system-webhooks": "webhooks_monitoring",
  "system-webhook-detail": "webhooks_monitoring",
  "system-jobs": "background_jobs_monitor",
  /** No separate Stitch folder; detail UI extends the jobs monitor pattern. */
  "system-job-detail": "background_jobs_monitor",
  "system-integrations-health": "integration_health_exception_monitor"
};

const STITCH_ROOT = "docs/admin frontend UI /stitch";

export type StitchReference = {
  slug: string;
  /** Path from repository root; use in IDE or docs (contains spaces). */
  directory: string;
  codeHtml: string;
  screenPng: string;
};

export const getStitchReference = (screenId: string): StitchReference | null => {
  const slug = stitchExportSlugByScreenId[screenId];
  if (!slug) {
    return null;
  }

  const directory = `${STITCH_ROOT}/${slug}`;
  return {
    slug,
    directory,
    codeHtml: `${directory}/code.html`,
    screenPng: `${directory}/screen.png`
  };
};
