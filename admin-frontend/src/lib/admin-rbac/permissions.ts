const permissionAliasMap: Record<string, readonly string[]> = {
  "catalog.products.mutate": ["catalog.products.write"],
  "catalog.products.create": ["catalog.products.write"],
  "catalog.products.update": ["catalog.products.write"],
  "catalog.variants.mutate": ["catalog.products.write"],
  "catalog.variants.read": ["catalog.products.read"],
  "catalog.media.mutate": ["catalog.products.write"],
  "catalog.media.read": ["catalog.products.read"],
  "catalog.categories.mutate": ["catalog.categories.write"],
  "catalog.brands.mutate": ["catalog.brands.write"],
  "catalog.reviews.read": ["reviews.moderate"],
  "catalog.reviews.moderate": ["reviews.moderate"],
  "content.pages.mutate": ["content.pages.write"],
  "content.banners.read": ["content.pages.read"],
  "content.banners.mutate": ["content.pages.write"],
  "marketing.coupons.mutate": ["marketing.coupons.write"],
  "marketing.promotions.mutate": ["marketing.promotions.write"],
  "customers.note": ["customers.write_notes"],
  "customers.suspend": ["customers.update_status"],
  "customers.reactivate": ["customers.update_status"],
  "customers.restore": ["customers.update_status"],
  "security.read": ["security.events.read", "security.audit.read"],
  "security.alerts.read": ["security.events.read"],
  "security.alerts.manage": ["security.events.read"],
  "security.events.manage": ["security.events.read"],
  "security.incidents.read": ["security.incidents.manage"],
  "security.incidents.create": ["security.incidents.manage"],
  "security.risk.read": ["security.events.read"],
  "security.risk.review": ["security.events.read"],
  "payments.investigate": ["payments.read"],
  "inventory.warehouses.read": ["inventory.read"],
  "inventory.warehouses.mutate": ["inventory.manage_warehouses"],
  "support.escalate": ["support.assign"],
  "marketing.promotions.rules.mutate": ["marketing.promotions.write"],
  "reports.products.read": ["reports.read"],
  "reports.inventory.read": ["reports.read"],
  "reports.customers.read": ["reports.read"],
  "reports.support.read": ["reports.read"],
  "reports.post_purchase.read": ["reports.read"],
  "reports.marketing.read": ["reports.read"],
  "marketing.analytics.read": ["reports.read"],
  "catalog.analytics.read": ["reports.read"],
  "system.integrations.read": ["integrations.webhooks.read"],
  "system.notifications.retry": ["notifications.write"]
};

const expandedPermissionsFor = (code: string) => {
  const aliases = permissionAliasMap[code] ?? [];
  return [code, ...aliases];
};

export const adminHasAnyPermission = (
  actorPermissions: readonly string[] | undefined,
  required: readonly string[]
): boolean => {
  if (required.length === 0) {
    return true;
  }
  if (!actorPermissions || actorPermissions.length === 0) {
    return false;
  }
  const set = new Set<string>();
  for (const permission of actorPermissions) {
    for (const expanded of expandedPermissionsFor(permission)) {
      set.add(expanded);
    }
  }
  return required.some((code) => expandedPermissionsFor(code).some((candidate) => set.has(candidate)));
};
