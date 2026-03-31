/** Roles that bypass granular permission checks (UI + `actorHasPermissions`). */
export const FULL_ACCESS_ADMIN_ROLE_CODES = ["super_admin", "platform_admin"] as const;

export const permissionCatalog = [
  { code: "catalog.products.read", domain: "catalog", description: "Read product catalog data." },
  { code: "catalog.products.write", domain: "catalog", description: "Create and edit products." },
  { code: "catalog.products.publish", domain: "catalog", description: "Publish and archive products." },
  { code: "catalog.products.change_price", domain: "catalog", description: "Change product and variant pricing." },
  { code: "catalog.categories.read", domain: "catalog", description: "Read categories." },
  { code: "catalog.categories.write", domain: "catalog", description: "Create and edit categories." },
  { code: "catalog.brands.read", domain: "catalog", description: "Read brands." },
  { code: "catalog.brands.write", domain: "catalog", description: "Create and edit brands." },
  { code: "inventory.read", domain: "inventory", description: "Read inventory and warehouse state." },
  { code: "inventory.adjust", domain: "inventory", description: "Adjust stock and warehouse state." },
  { code: "inventory.manage_warehouses", domain: "inventory", description: "Create and update warehouses." },
  { code: "orders.read", domain: "orders", description: "Read order data." },
  { code: "orders.update", domain: "orders", description: "Update order and fulfillment state." },
  { code: "orders.cancel", domain: "orders", description: "Cancel eligible orders and approve cancellation actions." },
  {
    code: "orders.override_fulfillment",
    domain: "orders",
    description: "Create shipments and override fulfillment progress."
  },
  { code: "payments.read", domain: "payments", description: "Read payment data." },
  { code: "refunds.approve", domain: "refunds", description: "Approve and reject refunds." },
  { code: "customers.read", domain: "customers", description: "Read customer detail and activity." },
  { code: "customers.update_status", domain: "customers", description: "Suspend and restore customer accounts." },
  { code: "customers.write_notes", domain: "customers", description: "Create internal customer notes." },
  { code: "support.read", domain: "support", description: "Read support queues and ticket detail." },
  { code: "support.reply", domain: "support", description: "Reply to support conversations." },
  { code: "support.assign", domain: "support", description: "Assign tickets and update ownership." },
  { code: "reviews.moderate", domain: "reviews", description: "Moderate customer reviews." },
  { code: "content.pages.read", domain: "content", description: "Read CMS pages and banners." },
  { code: "content.pages.write", domain: "content", description: "Edit CMS pages and banners." },
  { code: "marketing.promotions.read", domain: "marketing", description: "Read promotions and campaigns." },
  { code: "marketing.promotions.write", domain: "marketing", description: "Edit promotions and campaigns." },
  { code: "marketing.coupons.read", domain: "marketing", description: "Read coupons." },
  { code: "marketing.coupons.write", domain: "marketing", description: "Edit coupons." },
  { code: "notifications.read", domain: "notifications", description: "Read notification delivery state." },
  { code: "notifications.write", domain: "notifications", description: "Create and retry notifications." },
  { code: "reports.read", domain: "reports", description: "Read reports and dashboards." },
  { code: "reports.sales.read", domain: "reports", description: "Read sales analytics and dashboard slices." },
  { code: "dashboard.read", domain: "dashboard", description: "Open executive dashboard overview." },
  {
    code: "operations.dashboard.read",
    domain: "dashboard",
    description: "Open operations and fulfillment health dashboard."
  },
  { code: "support.analytics.read", domain: "support", description: "Read support analytics dashboard." },
  {
    code: "security.dashboard.read",
    domain: "security",
    description: "Open risk and security signals dashboard."
  },
  {
    code: "system.observability.read",
    domain: "system",
    description: "Read system health, jobs, and integration observability dashboard."
  },
  { code: "security.audit.read", domain: "security", description: "Read audit logs." },
  { code: "security.events.read", domain: "security", description: "Read security events and alerts." },
  { code: "security.incidents.manage", domain: "security", description: "Manage incidents." },
  { code: "settings.read", domain: "settings", description: "Read system settings." },
  { code: "settings.write", domain: "settings", description: "Edit system settings." },
  { code: "admin.manage_roles", domain: "admin", description: "Manage admin roles and permission assignment." },
  { code: "system.jobs.read", domain: "system", description: "Read job processing state." },
  { code: "system.jobs.run", domain: "system", description: "Enqueue operational diagnostics and jobs." },
  { code: "system.jobs.retry", domain: "system", description: "Retry tracked operational job runs." },
  { code: "integrations.webhooks.read", domain: "integrations", description: "Read webhook monitoring state." },
  {
    code: "integrations.webhooks.write",
    domain: "integrations",
    description: "Retry and mutate webhook processing (operational)."
  },
  { code: "system.webhooks.read", domain: "system", description: "Read webhook monitoring state." },
  { code: "system.webhooks.retry", domain: "system", description: "Retry tracked webhook processing." }
] as const;

export const defaultRoleCatalog = [
  {
    code: "super_admin",
    name: "Super Admin",
    permissions: permissionCatalog.map((permission) => permission.code)
  },
  {
    code: "platform_admin",
    name: "Platform Admin",
    permissions: permissionCatalog.map((permission) => permission.code)
  },
  {
    code: "catalog_manager",
    name: "Catalog Manager",
    permissions: [
      "catalog.products.read",
      "catalog.products.write",
      "catalog.products.publish",
      "catalog.products.change_price",
      "catalog.categories.read",
      "catalog.categories.write",
      "catalog.brands.read",
      "catalog.brands.write",
      "marketing.promotions.read",
      "marketing.promotions.write",
      "marketing.coupons.read",
      "marketing.coupons.write",
      "notifications.read",
      "notifications.write",
      "content.pages.read",
      "content.pages.write",
      "reports.read"
    ]
  },
  {
    code: "inventory_manager",
    name: "Inventory Manager",
    permissions: [
      "inventory.read",
      "inventory.adjust",
      "inventory.manage_warehouses",
      "orders.read",
      "orders.update"
    ]
  },
  {
    code: "fulfillment_manager",
    name: "Fulfillment Manager",
    permissions: [
      "orders.read",
      "orders.update",
      "orders.cancel",
      "orders.override_fulfillment",
      "inventory.read",
      "support.read"
    ]
  },
  {
    code: "finance_admin",
    name: "Finance Admin",
    permissions: ["orders.read", "payments.read", "refunds.approve", "reports.read"]
  },
  {
    code: "support_lead",
    name: "Support Lead",
    permissions: [
      "customers.read",
      "customers.update_status",
      "customers.write_notes",
      "support.read",
      "support.reply",
      "support.assign",
      "orders.read",
      "orders.cancel",
      "reviews.moderate"
    ]
  },
  {
    code: "support_agent",
    name: "Support Agent",
    permissions: ["customers.read", "customers.write_notes", "support.read", "support.reply", "orders.read"]
  },
  {
    code: "content_marketing_manager",
    name: "Content and Marketing Manager",
    permissions: [
      "content.pages.read",
      "content.pages.write",
      "marketing.promotions.read",
      "marketing.promotions.write",
      "marketing.coupons.read",
      "marketing.coupons.write",
      "notifications.read",
      "notifications.write",
      "catalog.products.read",
      "reports.read"
    ]
  },
  {
    code: "analyst",
    name: "Analyst",
    permissions: [
      "reports.read",
      "orders.read",
      "customers.read",
      "payments.read",
      "security.audit.read",
      "notifications.read",
      "system.jobs.read",
      "integrations.webhooks.read"
    ]
  }
] as const;

export type PermissionCode = (typeof permissionCatalog)[number]["code"];
