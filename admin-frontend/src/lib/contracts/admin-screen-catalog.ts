import type { AdminEndpointDefinition } from "@/lib/contracts/admin-endpoints";
import { adminEndpointLookup } from "@/lib/contracts/admin-endpoints";
import { stitchExportSlugByScreenId } from "@/lib/stitch/stitch-screen-map";

export type AdminScreenGroup =
  | "access-shell"
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

export type AdminScreenDefinition = {
  sequence: number;
  id: string;
  title: string;
  group: AdminScreenGroup;
  path: string;
  purpose: string;
  navLabel?: string;
  showInSidebar?: boolean;
  publicRoute?: boolean;
  endpointIds: string[];
  actions: string[];
  permissionHints: string[];
};

export type AdminScreenResolved = Omit<AdminScreenDefinition, "endpointIds"> & {
  endpoints: AdminEndpointDefinition[];
};

const screen = (definition: AdminScreenDefinition): AdminScreenResolved => ({
  ...definition,
  endpoints: definition.endpointIds.map((endpointId) => adminEndpointLookup[endpointId as keyof typeof adminEndpointLookup])
});

const accessShellScreens = [
  screen({
    sequence: 1,
    id: "admin-login",
    title: "Admin Login",
    group: "access-shell",
    path: "/admin/login",
    purpose: "Secure entry point for authenticated administrators.",
    publicRoute: true,
    endpointIds: ["platform.clientConfig", "auth.login"],
    actions: ["Sign in", "Open forgot-password flow"],
    permissionHints: []
  }),
  screen({
    sequence: 2,
    id: "admin-forgot-password",
    title: "Forgot Password",
    group: "access-shell",
    path: "/admin/forgot-password",
    purpose: "Initiate admin password recovery.",
    publicRoute: true,
    endpointIds: ["platform.clientConfig", "auth.forgotPassword"],
    actions: ["Submit recovery email", "Return to login"],
    permissionHints: []
  }),
  screen({
    sequence: 3,
    id: "admin-reset-password",
    title: "Reset Password",
    group: "access-shell",
    path: "/admin/reset-password",
    purpose: "Complete the admin password reset flow from a recovery link.",
    publicRoute: true,
    endpointIds: ["platform.clientConfig", "auth.resetPassword"],
    actions: ["Validate token", "Set new password"],
    permissionHints: []
  }),
  screen({
    sequence: 4,
    id: "admin-forbidden",
    title: "Forbidden",
    group: "access-shell",
    path: "/admin/forbidden",
    purpose: "Inform an admin they lack access to a route or action.",
    publicRoute: true,
    endpointIds: ["auth.me"],
    actions: ["Navigate back", "Request access through support or security process"],
    permissionHints: []
  }),
  screen({
    sequence: 5,
    id: "admin-profile-security",
    title: "Profile and Session Security",
    group: "access-shell",
    path: "/admin/profile/security",
    purpose: "Manage active sessions, security posture, and the current admin shell context.",
    endpointIds: ["auth.me", "auth.sessions", "auth.revokeSession", "auth.revokeAll", "auth.logout"],
    actions: ["Review session list", "Revoke one session", "Revoke all other sessions", "Sign out"],
    permissionHints: []
  })
] as const;

const dashboardScreens = [
  screen({
    sequence: 6,
    id: "dashboard-overview",
    title: "Executive Dashboard Overview",
    group: "dashboard",
    path: "/admin/dashboard",
    navLabel: "Overview",
    showInSidebar: true,
    purpose: "Top-level business, operations, support, and risk summary.",
    endpointIds: ["dashboard.overview", "dashboard.recentActivity"],
    actions: ["Refresh KPI summary", "Drill into operational hotspots", "Open recent activity"],
    permissionHints: ["dashboard.read"]
  }),
  screen({
    sequence: 7,
    id: "dashboard-sales",
    title: "Sales Performance Dashboard",
    group: "dashboard",
    path: "/admin/dashboard/sales",
    purpose: "Revenue, orders, AOV, discount, and payment-performance analytics.",
    endpointIds: ["dashboard.sales"],
    actions: ["Change date range", "Inspect product contributors", "Review payment success trends"],
    permissionHints: ["reports.sales.read"]
  }),
  screen({
    sequence: 8,
    id: "dashboard-operations",
    title: "Operations Control Dashboard",
    group: "dashboard",
    path: "/admin/dashboard/operations",
    purpose: "Action-oriented fulfillment and stock health dashboard.",
    endpointIds: ["dashboard.operations", "inventory.lowStock", "orders.fulfillmentQueue", "orders.dispatchQueue"],
    actions: ["Open fulfillment queue", "Open dispatch queue", "Inspect stock risk"],
    permissionHints: ["operations.dashboard.read"]
  }),
  screen({
    sequence: 9,
    id: "dashboard-support",
    title: "Customer Service Dashboard",
    group: "dashboard",
    path: "/admin/dashboard/support",
    purpose: "Service backlog, SLA pressure, and complaint summary.",
    endpointIds: ["dashboard.support", "support.queues.sla", "support.queues.complaints"],
    actions: ["Open SLA queue", "Open complaints queue", "Review support performance"],
    permissionHints: ["support.analytics.read"]
  }),
  screen({
    sequence: 10,
    id: "dashboard-risk",
    title: "Risk and Security Dashboard",
    group: "dashboard",
    path: "/admin/dashboard/risk",
    purpose: "Alerts, security signals, fraud indicators, and open incident summary.",
    endpointIds: ["dashboard.risk", "security.alerts.list", "security.riskSignals", "security.incidents.list"],
    actions: ["Open active alert", "Inspect risk signals", "Escalate to incident workspace"],
    permissionHints: ["security.dashboard.read"]
  }),
  screen({
    sequence: 11,
    id: "dashboard-system-health",
    title: "System Health Dashboard",
    group: "dashboard",
    path: "/admin/dashboard/system-health",
    purpose: "Webhook, background job, and integration-health overview.",
    endpointIds: ["dashboard.systemHealth", "system.jobs.list", "system.webhooks.list", "system.integrations.health"],
    actions: ["Inspect failed jobs", "Inspect failed webhooks", "Open integration exceptions"],
    permissionHints: ["system.observability.read"]
  })
] as const;

const catalogScreens = [
  screen({
    sequence: 12,
    id: "catalog-product-list",
    title: "Product List",
    group: "catalog",
    path: "/admin/catalog/products",
    navLabel: "Products",
    showInSidebar: true,
    purpose: "Searchable and filterable control surface for the catalog.",
    endpointIds: ["catalog.products.list"],
    actions: ["Search and filter products", "Open create form", "Archive product", "Publish product", "Open analytics"],
    permissionHints: ["catalog.products.read", "catalog.products.mutate"]
  }),
  screen({
    sequence: 13,
    id: "catalog-product-create",
    title: "Product Create",
    group: "catalog",
    path: "/admin/catalog/products/new",
    purpose: "Create a product with structured data entry and initial merchandising fields.",
    endpointIds: ["catalog.products.create", "catalog.categories.list", "catalog.brands.list"],
    actions: ["Create product", "Save draft", "Attach category and brand"],
    permissionHints: ["catalog.products.create"]
  }),
  screen({
    sequence: 14,
    id: "catalog-product-edit",
    title: "Product Edit",
    group: "catalog",
    path: "/admin/catalog/products/:productId/edit",
    purpose: "Edit a product with audit-aware field mutations and unsaved-change protection.",
    endpointIds: ["catalog.products.detail", "catalog.products.update", "catalog.categories.list", "catalog.brands.list"],
    actions: ["Update product fields", "Save edits", "Return to product overview"],
    permissionHints: ["catalog.products.update"]
  }),
  screen({
    sequence: 15,
    id: "catalog-product-detail",
    title: "Product Detail Overview",
    group: "catalog",
    path: "/admin/catalog/products/:productId",
    purpose: "Product command center with linked variants, media, pricing, inventory, and activity.",
    endpointIds: ["catalog.products.detail", "catalog.products.activity", "catalog.inventorySummary"],
    actions: ["Open variants", "Open pricing", "Open media", "Publish or unpublish product"],
    permissionHints: ["catalog.products.read"]
  }),
  screen({
    sequence: 16,
    id: "catalog-product-analytics",
    title: "Product Analytics Detail",
    group: "catalog",
    path: "/admin/catalog/products/:productId/analytics",
    purpose: "Dedicated analytics for a single product.",
    endpointIds: ["catalog.products.analytics"],
    actions: ["Change date range", "Inspect revenue contribution", "Review return and refund behavior"],
    permissionHints: ["catalog.analytics.read"]
  }),
  screen({
    sequence: 17,
    id: "catalog-product-variants",
    title: "Product Variants Management",
    group: "catalog",
    path: "/admin/catalog/products/:productId/variants",
    purpose: "Variant creation and mutation workspace with availability and pricing adjacency.",
    endpointIds: ["catalog.variants.list", "catalog.variants.create", "catalog.variants.update"],
    actions: ["Create variant", "Edit variant", "Inspect stock and price per variant"],
    permissionHints: ["catalog.variants.read", "catalog.variants.mutate"]
  }),
  screen({
    sequence: 18,
    id: "catalog-product-media",
    title: "Product Media Management",
    group: "catalog",
    path: "/admin/catalog/products/:productId/media",
    purpose: "Upload, order, and map media assets for products.",
    endpointIds: ["catalog.media.list", "catalog.media.uploadIntent", "catalog.media.create", "catalog.media.reorder", "catalog.media.delete"],
    actions: ["Create upload intent", "Persist uploaded media", "Reorder gallery", "Delete media"],
    permissionHints: ["catalog.media.read", "catalog.media.mutate"]
  }),
  screen({
    sequence: 19,
    id: "catalog-product-pricing",
    title: "Product Pricing and Merchandising",
    group: "catalog",
    path: "/admin/catalog/products/:productId/pricing",
    purpose: "Price, compare-at price, merchandising state, and publish-readiness workspace.",
    endpointIds: ["catalog.pricing.detail", "catalog.pricing.update", "catalog.products.publish", "catalog.products.unpublish"],
    actions: ["Update price", "Update compare-at price", "Publish or unpublish product"],
    permissionHints: ["catalog.products.change_price", "catalog.products.publish"]
  }),
  screen({
    sequence: 20,
    id: "catalog-product-inventory",
    title: "Product Inventory Summary",
    group: "catalog",
    path: "/admin/catalog/products/:productId/inventory",
    purpose: "Inventory-by-variant summary with warehouse drill-down links.",
    endpointIds: ["catalog.inventorySummary", "inventory.movements"],
    actions: ["Inspect stock by variant", "Open movement history", "Open warehouse inventory"],
    permissionHints: ["inventory.read"]
  }),
  screen({
    sequence: 21,
    id: "catalog-categories",
    title: "Category Management",
    group: "catalog",
    path: "/admin/catalog/categories",
    navLabel: "Categories",
    showInSidebar: true,
    purpose: "Category list and hierarchy management.",
    endpointIds: ["catalog.categories.list", "catalog.categories.create", "catalog.categories.update", "catalog.categories.archive"],
    actions: ["Create category", "Edit category", "Archive category"],
    permissionHints: ["catalog.categories.read", "catalog.categories.mutate"]
  }),
  screen({
    sequence: 211,
    id: "catalog-category-new",
    title: "Create Category",
    group: "catalog",
    path: "/admin/catalog/categories/new",
    purpose: "Create a new catalog category with URL slug and display name.",
    endpointIds: ["catalog.categories.create"],
    actions: ["Save category"],
    permissionHints: ["catalog.categories.write"]
  }),
  screen({
    sequence: 212,
    id: "catalog-category-edit",
    title: "Edit Category",
    group: "catalog",
    path: "/admin/catalog/categories/:categoryId/edit",
    purpose: "Update category slug or name, or archive the category.",
    endpointIds: ["catalog.categories.list", "catalog.categories.update", "catalog.categories.archive"],
    actions: ["Save changes", "Archive category"],
    permissionHints: ["catalog.categories.read", "catalog.categories.write"]
  }),
  screen({
    sequence: 22,
    id: "catalog-brands",
    title: "Brand Management",
    group: "catalog",
    path: "/admin/catalog/brands",
    navLabel: "Brands",
    showInSidebar: true,
    purpose: "Brand list and linked product control.",
    endpointIds: ["catalog.brands.list", "catalog.brands.create", "catalog.brands.update", "catalog.brands.archive"],
    actions: ["Create brand", "Edit brand", "Archive brand"],
    permissionHints: ["catalog.brands.read", "catalog.brands.mutate"]
  }),
  screen({
    sequence: 221,
    id: "catalog-brand-new",
    title: "Create Brand",
    group: "catalog",
    path: "/admin/catalog/brands/new",
    purpose: "Create a new brand with URL slug and display name.",
    endpointIds: ["catalog.brands.create"],
    actions: ["Save brand"],
    permissionHints: ["catalog.brands.write"]
  }),
  screen({
    sequence: 222,
    id: "catalog-brand-edit",
    title: "Edit Brand",
    group: "catalog",
    path: "/admin/catalog/brands/:brandId/edit",
    purpose: "Update brand slug or name, or archive the brand.",
    endpointIds: ["catalog.brands.list", "catalog.brands.update", "catalog.brands.archive"],
    actions: ["Save changes", "Archive brand"],
    permissionHints: ["catalog.brands.read", "catalog.brands.write"]
  }),
  screen({
    sequence: 23,
    id: "catalog-reviews",
    title: "Reviews Moderation",
    group: "catalog",
    path: "/admin/catalog/reviews",
    navLabel: "Reviews",
    showInSidebar: true,
    purpose: "Moderate customer reviews with queue filters and detail inspection.",
    endpointIds: ["catalog.reviews.list", "catalog.reviews.detail", "catalog.reviews.moderate"],
    actions: ["Open review detail", "Publish review", "Hide review", "Reject review"],
    permissionHints: ["catalog.reviews.read", "catalog.reviews.moderate"]
  })
] as const;

const inventoryScreens = [
  screen({
    sequence: 24,
    id: "inventory-overview",
    title: "Inventory Overview",
    group: "inventory",
    path: "/admin/inventory/overview",
    navLabel: "Overview",
    showInSidebar: true,
    purpose: "Master stock overview across products, variants, and warehouses.",
    endpointIds: ["inventory.overview"],
    actions: ["Filter stock rows", "Open low-stock queue", "Open warehouse detail"],
    permissionHints: ["inventory.read"]
  }),
  screen({
    sequence: 25,
    id: "inventory-low-stock",
    title: "Inventory Low-Stock Queue",
    group: "inventory",
    path: "/admin/inventory/low-stock",
    navLabel: "Low stock",
    showInSidebar: true,
    purpose: "Queue of stock rows below reorder level.",
    endpointIds: ["inventory.lowStock"],
    actions: ["Prioritize replenishment", "Open product inventory summary", "Open warehouse inventory"],
    permissionHints: ["inventory.read"]
  }),
  screen({
    sequence: 26,
    id: "inventory-out-of-stock",
    title: "Inventory Out-of-Stock Queue",
    group: "inventory",
    path: "/admin/inventory/out-of-stock",
    navLabel: "Out of stock",
    showInSidebar: true,
    purpose: "Queue of unavailable stock rows needing operational response.",
    endpointIds: ["inventory.outOfStock"],
    actions: ["Review urgency", "Open product detail", "Open warehouse inventory"],
    permissionHints: ["inventory.read"]
  }),
  screen({
    sequence: 27,
    id: "inventory-warehouses",
    title: "Warehouse List",
    group: "inventory",
    path: "/admin/inventory/warehouses",
    navLabel: "Warehouses",
    showInSidebar: true,
    purpose: "Warehouse management table with operational summaries.",
    endpointIds: ["inventory.warehouses.list", "inventory.warehouses.create"],
    actions: ["Create warehouse", "Open warehouse detail"],
    permissionHints: ["inventory.read", "inventory.manage_warehouses"]
  }),
  screen({
    sequence: 28,
    id: "inventory-movements",
    title: "Inventory Movement History",
    group: "inventory",
    path: "/admin/inventory/movements",
    navLabel: "Movements",
    showInSidebar: true,
    purpose: "Immutable inventory movement explorer.",
    endpointIds: ["inventory.movements"],
    actions: ["Filter movement log", "Inspect actor trace", "Open linked warehouse"],
    permissionHints: ["inventory.read"]
  }),
  screen({
    sequence: 29,
    id: "inventory-adjustments",
    title: "Inventory Adjustment Console",
    group: "inventory",
    path: "/admin/inventory/adjustments",
    navLabel: "Adjustments",
    showInSidebar: true,
    purpose: "Manual stock change workflow with confirmation and reason capture.",
    endpointIds: ["inventory.overview", "inventory.adjustments.create"],
    actions: ["Preview resulting stock", "Submit manual adjustment", "Capture reason and note"],
    permissionHints: ["inventory.adjust"]
  }),
  screen({
    sequence: 30,
    id: "inventory-warehouse-detail",
    title: "Warehouse Detail",
    group: "inventory",
    path: "/admin/inventory/warehouses/:warehouseId",
    purpose: "Warehouse summary, stock health, and movement-adjacent detail.",
    endpointIds: ["inventory.warehouses.detail", "inventory.warehouses.update"],
    actions: ["Edit warehouse", "Open warehouse inventory", "Review linked operations"],
    permissionHints: ["inventory.warehouses.read", "inventory.warehouses.mutate"]
  }),
  screen({
    sequence: 31,
    id: "inventory-warehouse-stock",
    title: "Warehouse Inventory Detail",
    group: "inventory",
    path: "/admin/inventory/warehouses/:warehouseId/inventory",
    purpose: "Warehouse-scoped stock grid with drill-down actions.",
    endpointIds: ["inventory.warehouses.inventory", "inventory.movements"],
    actions: ["Inspect stock rows", "Open movement history", "Open product inventory summary"],
    permissionHints: ["inventory.read"]
  })
] as const;

const orderScreens = [
  screen({
    sequence: 32,
    id: "orders-list",
    title: "Orders List",
    group: "orders",
    path: "/admin/orders",
    navLabel: "Orders",
    showInSidebar: true,
    purpose: "Central order operations queue.",
    endpointIds: ["orders.list"],
    actions: ["Search and filter orders", "Open order detail", "Open queue views"],
    permissionHints: ["orders.read"]
  }),
  screen({
    sequence: 33,
    id: "orders-detail",
    title: "Order Detail",
    group: "orders",
    path: "/admin/orders/:orderId",
    purpose: "Single source of truth for order operations.",
    endpointIds: ["orders.detail", "orders.assignWarehouse", "orders.cancel", "orders.updateStatus"],
    actions: ["Update order status", "Assign warehouse", "Cancel order", "Open shipment detail"],
    permissionHints: ["orders.read", "orders.update", "orders.cancel"]
  }),
  screen({
    sequence: 34,
    id: "orders-timeline",
    title: "Order Timeline Detail",
    group: "orders",
    path: "/admin/orders/:orderId/timeline",
    purpose: "Detailed status, activity, and audit timeline for one order.",
    endpointIds: ["orders.timeline"],
    actions: ["Inspect chronology", "Trace linked refund and return events"],
    permissionHints: ["orders.read"]
  }),
  screen({
    sequence: 35,
    id: "orders-fulfillment-queue",
    title: "Fulfillment Queue",
    group: "orders",
    path: "/admin/orders/fulfillment-queue",
    navLabel: "Fulfillment queue",
    showInSidebar: true,
    purpose: "Orders awaiting picking or fulfillment start.",
    endpointIds: ["orders.fulfillmentQueue", "orders.assignWarehouse", "shipments.create"],
    actions: ["Assign warehouse", "Open order detail", "Create shipment"],
    permissionHints: ["orders.read", "orders.override_fulfillment"]
  }),
  screen({
    sequence: 36,
    id: "orders-dispatch-queue",
    title: "Packing and Dispatch Queue",
    group: "orders",
    path: "/admin/orders/dispatch-queue",
    navLabel: "Dispatch queue",
    showInSidebar: true,
    purpose: "Orders ready for courier handoff.",
    endpointIds: ["orders.dispatchQueue", "shipments.create"],
    actions: ["Open shipment", "Create shipment if missing", "Move to dispatch workflow"],
    permissionHints: ["orders.read", "orders.override_fulfillment"]
  }),
  screen({
    sequence: 36.5,
    id: "shipments-hub",
    title: "Shipments hub",
    group: "orders",
    path: "/admin/shipments",
    navLabel: "Shipments",
    showInSidebar: true,
    purpose: "Jump to shipment detail or tracking by id; discover ids from order and queue views.",
    endpointIds: ["shipments.detail"],
    actions: ["Paste shipment id", "Open detail", "Open tracking timeline"],
    permissionHints: ["orders.read"]
  }),
  screen({
    sequence: 37,
    id: "shipments-detail",
    title: "Shipment Detail",
    group: "orders",
    path: "/admin/shipments/:shipmentId",
    purpose: "Shipment summary and operational controls.",
    endpointIds: ["shipments.detail", "shipments.update"],
    actions: ["Update shipment", "Open tracking events", "Open linked order"],
    permissionHints: ["orders.read", "orders.override_fulfillment"]
  }),
  screen({
    sequence: 38,
    id: "shipments-tracking",
    title: "Shipment Tracking Events",
    group: "orders",
    path: "/admin/shipments/:shipmentId/tracking",
    purpose: "Event-level shipment tracking history and append workflow.",
    endpointIds: ["shipments.tracking", "shipments.trackingCreate"],
    actions: ["Append tracking event", "Progress shipment state", "Review delivery chronology"],
    permissionHints: ["orders.read", "orders.override_fulfillment"]
  }),
  screen({
    sequence: 39,
    id: "returns-queue",
    title: "Returns Queue",
    group: "orders",
    path: "/admin/returns",
    navLabel: "Returns",
    showInSidebar: true,
    purpose: "Centralized return request queue.",
    endpointIds: ["returns.list"],
    actions: ["Search and filter returns", "Open return detail"],
    permissionHints: ["orders.read"]
  }),
  screen({
    sequence: 40,
    id: "returns-detail",
    title: "Return Detail",
    group: "orders",
    path: "/admin/returns/:returnId",
    purpose: "Return review, approval, receipt, and completion workspace.",
    endpointIds: ["returns.detail", "returns.approve", "returns.reject", "returns.markReceived", "returns.complete"],
    actions: ["Approve return", "Reject return", "Mark received", "Complete return"],
    permissionHints: ["orders.read", "orders.update"]
  }),
  screen({
    sequence: 41,
    id: "orders-cancellation-requests",
    title: "Cancellation Requests Queue",
    group: "orders",
    path: "/admin/orders/cancellation-requests",
    navLabel: "Cancellations",
    showInSidebar: true,
    purpose: "Review and decision queue for order cancellations.",
    endpointIds: ["orders.cancellationRequests", "orders.cancellationApprove", "orders.cancellationReject"],
    actions: ["Approve cancellation", "Reject cancellation", "Open order detail"],
    permissionHints: ["orders.read", "orders.cancel"]
  })
] as const;

const paymentScreens = [
  screen({
    sequence: 42,
    id: "payments-list",
    title: "Payments List",
    group: "payments",
    path: "/admin/payments",
    navLabel: "Payments",
    showInSidebar: true,
    purpose: "Payment operations table with provider and status filters.",
    endpointIds: ["payments.list"],
    actions: ["Search and filter payments", "Open payment detail", "Open failed investigations"],
    permissionHints: ["payments.read"]
  }),
  screen({
    sequence: 43,
    id: "payments-detail",
    title: "Payment Detail",
    group: "payments",
    path: "/admin/payments/:paymentId",
    purpose: "Payment summary with order and refund linkage.",
    endpointIds: ["payments.detail"],
    actions: ["Inspect payment state", "Open transaction timeline", "Open linked order"],
    permissionHints: ["payments.read"]
  }),
  screen({
    sequence: 44,
    id: "payments-transactions",
    title: "Payment Transaction Timeline",
    group: "payments",
    path: "/admin/payments/:paymentId/transactions",
    purpose: "Provider transaction history and verification trace.",
    endpointIds: ["payments.transactions"],
    actions: ["Inspect provider references", "Trace retries and callbacks"],
    permissionHints: ["payments.read"]
  }),
  screen({
    sequence: 45,
    id: "refunds-queue",
    title: "Refunds Queue",
    group: "payments",
    path: "/admin/refunds",
    navLabel: "Refunds",
    showInSidebar: true,
    purpose: "Refund approval and tracking queue.",
    endpointIds: ["refunds.list"],
    actions: ["Search refunds", "Open refund detail"],
    permissionHints: ["payments.read"]
  }),
  screen({
    sequence: 46,
    id: "refunds-detail",
    title: "Refund Detail",
    group: "payments",
    path: "/admin/refunds/:refundId",
    purpose: "Refund command page with approval state and provider trace.",
    endpointIds: ["refunds.detail", "refunds.approve", "refunds.reject", "refunds.markCompleted"],
    actions: ["Approve refund", "Reject refund", "Mark completed"],
    permissionHints: ["payments.read", "refunds.approve"]
  }),
  screen({
    sequence: 47,
    id: "payments-failed-investigations",
    title: "Failed Payments Investigation",
    group: "payments",
    path: "/admin/payments/failed-investigations",
    navLabel: "Failed payments",
    showInSidebar: true,
    purpose: "Investigate payment failures and provider-level patterns.",
    endpointIds: ["payments.failedInvestigations"],
    actions: ["Inspect failure reasons", "Open affected payment", "Trace provider pattern"],
    permissionHints: ["payments.read", "payments.investigate"]
  }),
  screen({
    sequence: 48,
    id: "finance-exceptions",
    title: "Financial Exceptions and Reconciliation",
    group: "payments",
    path: "/admin/finance/exceptions",
    navLabel: "Finance exceptions",
    showInSidebar: true,
    purpose: "Operational queue for unresolved finance exceptions.",
    endpointIds: ["finance.exceptions", "finance.resolveException"],
    actions: ["Resolve exception", "Open linked payment or refund"],
    permissionHints: ["payments.read"]
  })
] as const;

const customerScreens = [
  screen({
    sequence: 49,
    id: "customers-list",
    title: "Customers List",
    group: "customers",
    path: "/admin/customers",
    navLabel: "Customers",
    showInSidebar: true,
    purpose: "Searchable customer intelligence table.",
    endpointIds: ["customers.list"],
    actions: ["Search and filter customers", "Open customer detail"],
    permissionHints: ["customers.read"]
  }),
  screen({
    sequence: 50,
    id: "customers-detail",
    title: "Customer Detail Overview",
    group: "customers",
    path: "/admin/customers/:customerId",
    purpose: "Customer 360 summary page.",
    endpointIds: ["customers.detail", "customers.internalActions", "customers.notes"],
    actions: ["Add internal note", "Record internal action", "Open subviews"],
    permissionHints: ["customers.read", "customers.note"]
  }),
  screen({
    sequence: 51,
    id: "customers-activity",
    title: "Customer Activity Timeline",
    group: "customers",
    path: "/admin/customers/:customerId/activity",
    purpose: "Unified timeline across customer activity domains.",
    endpointIds: ["customers.activity"],
    actions: ["Inspect timeline events", "Jump to linked entity"],
    permissionHints: ["customers.read"]
  }),
  screen({
    sequence: 52,
    id: "customers-orders",
    title: "Customer Orders History",
    group: "customers",
    path: "/admin/customers/:customerId/orders",
    purpose: "Customer-scoped orders table.",
    endpointIds: ["customers.orders"],
    actions: ["Open order", "Compare order history"],
    permissionHints: ["customers.read", "orders.read"]
  }),
  screen({
    sequence: 53,
    id: "customers-support",
    title: "Customer Support History",
    group: "customers",
    path: "/admin/customers/:customerId/support",
    purpose: "Customer-scoped support case history.",
    endpointIds: ["customers.support"],
    actions: ["Open support ticket", "Review service history"],
    permissionHints: ["customers.read", "support.read"]
  }),
  screen({
    sequence: 54,
    id: "customers-reviews",
    title: "Customer Reviews History",
    group: "customers",
    path: "/admin/customers/:customerId/reviews",
    purpose: "Customer review behavior and moderation history.",
    endpointIds: ["customers.reviews"],
    actions: ["Open review moderation", "Inspect review pattern"],
    permissionHints: ["customers.read", "catalog.reviews.read"]
  }),
  screen({
    sequence: 55,
    id: "customers-risk",
    title: "Customer Risk and Security Profile",
    group: "customers",
    path: "/admin/customers/:customerId/risk",
    purpose: "Fraud, abuse, and security-oriented customer investigation view.",
    endpointIds: ["customers.risk"],
    actions: ["Inspect risk markers", "Escalate for review"],
    permissionHints: ["customers.read", "security.read"]
  }),
  screen({
    sequence: 56,
    id: "customers-actions",
    title: "Customer Account Action Center",
    group: "customers",
    path: "/admin/customers/:customerId/actions",
    purpose: "Sensitive customer account actions with confirmation and audit support.",
    endpointIds: ["customers.suspend", "customers.reactivate", "customers.restore", "customers.internalActions"],
    actions: ["Suspend customer", "Reactivate customer", "Restore customer", "Record action reason"],
    permissionHints: ["customers.suspend", "customers.reactivate"]
  })
] as const;

const supportScreens = [
  screen({
    sequence: 57,
    id: "support-tickets",
    title: "Support Tickets List",
    group: "support",
    path: "/admin/support/tickets",
    navLabel: "Tickets",
    showInSidebar: true,
    purpose: "Ticket list across service workflows.",
    endpointIds: ["support.tickets.list"],
    actions: ["Search tickets", "Open ticket detail"],
    permissionHints: ["support.read"]
  }),
  screen({
    sequence: 58,
    id: "support-ticket-detail",
    title: "Support Ticket Detail",
    group: "support",
    path: "/admin/support/tickets/:ticketId",
    purpose: "Support conversation thread and assignment workspace.",
    endpointIds: [
      "support.tickets.detail",
      "support.tickets.reply",
      "support.tickets.internalNote",
      "support.tickets.assign",
      "support.tickets.status"
    ],
    actions: ["Reply to customer", "Add internal note", "Assign ticket", "Change status"],
    permissionHints: ["support.read", "support.reply", "support.assign"]
  }),
  screen({
    sequence: 59,
    id: "support-sla-queue",
    title: "Support Queue by SLA and Priority",
    group: "support",
    path: "/admin/support/queue",
    navLabel: "SLA queue",
    showInSidebar: true,
    purpose: "Priority/SLA service queue for urgent ticket handling.",
    endpointIds: ["support.queues.sla"],
    actions: ["Open urgent ticket", "Assign ticket", "Change queue filters"],
    permissionHints: ["support.read", "support.assign"]
  }),
  screen({
    sequence: 60,
    id: "support-pre-purchase",
    title: "Pre-Purchase Inquiries Queue",
    group: "support",
    path: "/admin/support/pre-purchase",
    navLabel: "Pre-purchase",
    showInSidebar: true,
    purpose: "Queue of product and pre-purchase inquiries.",
    endpointIds: ["support.queues.prePurchase"],
    actions: ["Open inquiry", "Respond or assign", "Review product context"],
    permissionHints: ["support.read", "support.reply"]
  }),
  screen({
    sequence: 61,
    id: "support-complaints",
    title: "Returns and Complaints Support Queue",
    group: "support",
    path: "/admin/support/complaints",
    navLabel: "Complaints",
    showInSidebar: true,
    purpose: "Complaint-oriented service queue tied to returns and escalations.",
    endpointIds: ["support.queues.complaints"],
    actions: ["Open complaint", "Escalate ticket", "Inspect linked return or order"],
    permissionHints: ["support.read", "support.escalate"]
  }),
  screen({
    sequence: 62,
    id: "support-analytics",
    title: "Support Analytics and SLA Reporting",
    group: "support",
    path: "/admin/support/analytics",
    navLabel: "Analytics",
    showInSidebar: true,
    purpose: "Support KPI, SLA, and service health analytics.",
    endpointIds: ["support.reports"],
    actions: ["Change date range", "Inspect SLA performance", "Review complaint trends"],
    permissionHints: ["support.analytics.read"]
  })
] as const;

const contentScreens = [
  screen({
    sequence: 63,
    id: "content-banners",
    title: "Banners Management",
    group: "content",
    path: "/admin/content/banners",
    navLabel: "Banners",
    showInSidebar: true,
    purpose: "Banner list, publishing, and media-aware content control.",
    endpointIds: [
      "content.banners.list",
      "content.media.uploadIntent",
      "content.banners.create",
      "content.banners.update",
      "content.banners.publish",
      "content.banners.unpublish",
      "content.banners.delete"
    ],
    actions: ["Create banner", "Create upload intent", "Publish or unpublish banner", "Edit banner"],
    permissionHints: ["content.banners.read", "content.banners.mutate"]
  }),
  screen({
    sequence: 64,
    id: "content-pages",
    title: "CMS Pages Management",
    group: "content",
    path: "/admin/content/pages",
    navLabel: "CMS pages",
    showInSidebar: true,
    purpose: "CMS page list, edit, and publish workflow.",
    endpointIds: ["content.pages.list", "content.pages.create", "content.pages.detail", "content.pages.update", "content.pages.publish"],
    actions: ["Create page", "Edit page", "Publish page"],
    permissionHints: ["content.pages.read", "content.pages.mutate"]
  })
] as const;

const marketingScreens = [
  screen({
    sequence: 65,
    id: "marketing-coupons",
    title: "Coupon Management",
    group: "marketing",
    path: "/admin/marketing/coupons",
    navLabel: "Coupons",
    showInSidebar: true,
    purpose: "Create, update, and disable coupons.",
    endpointIds: [
      "marketing.contract.coupons.list",
      "marketing.contract.coupons.create",
      "marketing.contract.coupons.update",
      "marketing.contract.coupons.disable"
    ],
    actions: ["Create coupon", "Edit coupon", "Disable coupon", "Restore coupon", "Delete unused coupon"],
    permissionHints: ["marketing.coupons.read", "marketing.coupons.mutate"]
  }),
  screen({
    sequence: 66,
    id: "marketing-coupon-analytics",
    title: "Coupon Redemption Analytics",
    group: "marketing",
    path: "/admin/marketing/coupons/analytics",
    navLabel: "Coupon analytics",
    showInSidebar: true,
    purpose: "Coupon usage and redemption performance view.",
    endpointIds: ["marketing.contract.coupons.analytics"],
    actions: ["Change date range", "Inspect coupon performance", "Open coupon detail"],
    permissionHints: ["marketing.analytics.read"]
  }),
  screen({
    sequence: 67,
    id: "marketing-promotions",
    title: "Promotions Management",
    group: "marketing",
    path: "/admin/marketing/promotions",
    navLabel: "Promotions",
    showInSidebar: true,
    purpose: "Promotion list and campaign-readiness management.",
    endpointIds: ["marketing.contract.promotions.list", "marketing.contract.promotions.create", "marketing.contract.promotions.update"],
    actions: ["Create promotion", "Edit promotion", "Open rules detail"],
    permissionHints: ["marketing.promotions.read", "marketing.promotions.mutate"]
  }),
  screen({
    sequence: 68,
    id: "marketing-promotion-rules-hub",
    title: "Promotion Rules",
    group: "marketing",
    path: "/admin/marketing/promotion-rules",
    navLabel: "Promotion rules",
    showInSidebar: true,
    purpose: "Pick a promotion and open its rule workspace.",
    endpointIds: ["marketing.contract.promotions.list", "marketing.contract.promotions.detail", "marketing.contract.promotions.rules.list", "marketing.contract.promotions.rules.create", "marketing.contract.promotions.rules.update"],
    actions: ["Open promotion rules"],
    permissionHints: ["marketing.promotions.read", "marketing.promotions.rules.mutate"]
  }),
  screen({
    sequence: 69,
    id: "marketing-promotion-rules",
    title: "Promotion Rules Detail",
    group: "marketing",
    path: "/admin/marketing/promotions/:promotionId/rules",
    purpose: "Rule definition and mutation workspace for a promotion.",
    endpointIds: ["marketing.contract.promotions.detail", "marketing.contract.promotions.rules.list", "marketing.contract.promotions.rules.create", "marketing.contract.promotions.rules.update"],
    actions: ["Review promotion", "Create rule", "Edit rule"],
    permissionHints: ["marketing.promotions.read", "marketing.promotions.rules.mutate"]
  }),
  screen({
    sequence: 70,
    id: "marketing-campaign-performance",
    title: "Campaign Performance Overview",
    group: "marketing",
    path: "/admin/marketing/campaigns/performance",
    navLabel: "Campaign performance",
    showInSidebar: true,
    purpose: "Campaign, promotion, and growth-performance analytics.",
    endpointIds: ["marketing.contract.campaignPerformance", "marketing.campaigns.list", "marketing.campaigns.detail"],
    actions: ["Inspect campaign performance", "Open campaign detail", "Compare marketing periods"],
    permissionHints: ["marketing.analytics.read"]
  })
] as const;

const reportScreens = [
  screen({
    sequence: 71,
    id: "reports-overview",
    title: "Reports Overview",
    group: "reports",
    path: "/admin/reports",
    navLabel: "Reports",
    showInSidebar: true,
    purpose: "Aggregated reporting entry point.",
    endpointIds: ["reports.overview", "reports.dashboard"],
    actions: ["Open report family", "Change reporting range"],
    permissionHints: ["reports.read"]
  }),
  screen({
    sequence: 72,
    id: "reports-sales",
    title: "Sales Analytics Report",
    group: "reports",
    path: "/admin/reports/sales",
    purpose: "Detailed sales reporting view.",
    endpointIds: ["reports.sales"],
    actions: ["Filter sales report", "Inspect trends", "Export later"],
    permissionHints: ["reports.sales.read"]
  }),
  screen({
    sequence: 73,
    id: "reports-products",
    title: "Product Performance Analytics",
    group: "reports",
    path: "/admin/reports/products",
    purpose: "Product performance and catalog-driven analytics.",
    endpointIds: ["reports.products"],
    actions: ["Inspect top products", "Open product analytics"],
    permissionHints: ["reports.products.read"]
  }),
  screen({
    sequence: 74,
    id: "reports-inventory",
    title: "Inventory Analytics Report",
    group: "reports",
    path: "/admin/reports/inventory",
    purpose: "Inventory performance and stock-risk reporting.",
    endpointIds: ["reports.inventory"],
    actions: ["Inspect stock health", "Review low-stock trends"],
    permissionHints: ["reports.inventory.read"]
  }),
  screen({
    sequence: 75,
    id: "reports-customers",
    title: "Customer Analytics Report",
    group: "reports",
    path: "/admin/reports/customers",
    purpose: "Customer growth, retention, and value reporting.",
    endpointIds: ["reports.customers"],
    actions: ["Inspect customer segments", "Review repeat behavior"],
    permissionHints: ["reports.customers.read"]
  }),
  screen({
    sequence: 76,
    id: "reports-support",
    title: "Support Analytics Report",
    group: "reports",
    path: "/admin/reports/support",
    purpose: "Support service performance reporting.",
    endpointIds: ["reports.support"],
    actions: ["Review SLA outcomes", "Compare support periods"],
    permissionHints: ["reports.support.read"]
  }),
  screen({
    sequence: 77,
    id: "reports-refunds-returns",
    title: "Refunds and Returns Analytics",
    group: "reports",
    path: "/admin/reports/refunds-returns",
    purpose: "Post-purchase quality and policy analytics.",
    endpointIds: ["reports.refundsReturns", "reports.postPurchase"],
    actions: ["Inspect return reasons", "Inspect refund trends"],
    permissionHints: ["reports.post_purchase.read"]
  }),
  screen({
    sequence: 78,
    id: "reports-marketing",
    title: "Marketing and Coupon Analytics",
    group: "reports",
    path: "/admin/reports/marketing",
    purpose: "Campaign and coupon performance reporting.",
    endpointIds: ["reports.marketing"],
    actions: ["Inspect campaign performance", "Compare coupon impact"],
    permissionHints: ["reports.marketing.read"]
  })
] as const;

const securityScreens = [
  screen({
    sequence: 79,
    id: "security-audit-logs",
    title: "Audit Logs Explorer",
    group: "security",
    path: "/admin/security/audit-logs",
    navLabel: "Security",
    showInSidebar: true,
    purpose: "Explore audit log records across entities.",
    endpointIds: ["security.auditLogs"],
    actions: ["Filter audit logs", "Inspect actor and entity trace"],
    permissionHints: ["security.audit.read"]
  }),
  screen({
    sequence: 80,
    id: "security-admin-actions",
    title: "Admin Action Logs Explorer",
    group: "security",
    path: "/admin/security/admin-actions",
    purpose: "Investigate admin-initiated mutations and actions.",
    endpointIds: ["security.adminActionLogs"],
    actions: ["Filter admin actions", "Trace before and after state"],
    permissionHints: ["security.audit.read"]
  }),
  screen({
    sequence: 81,
    id: "security-user-activity",
    title: "User Activity Explorer",
    group: "security",
    path: "/admin/security/user-activity",
    purpose: "Explore end-user activity signals and timelines.",
    endpointIds: ["security.userActivity"],
    actions: ["Filter user activity", "Open linked entity"],
    permissionHints: ["security.audit.read"]
  }),
  screen({
    sequence: 82,
    id: "security-alerts",
    title: "Alerts Center",
    group: "security",
    path: "/admin/security/alerts",
    purpose: "Operational alerts center for acknowledgement, assignment, and resolution.",
    endpointIds: ["security.alerts.list", "security.alerts.assign", "security.alerts.acknowledge", "security.alerts.resolve"],
    actions: ["Assign alert", "Acknowledge alert", "Resolve alert", "Open alert detail"],
    permissionHints: ["security.alerts.read", "security.alerts.manage"]
  }),
  screen({
    sequence: 83,
    id: "security-alert-detail",
    title: "Alert Detail",
    group: "security",
    path: "/admin/security/alerts/:alertId",
    purpose: "Single alert detail with entity and incident linkage.",
    endpointIds: ["security.alerts.detail", "security.alerts.assign", "security.alerts.acknowledge", "security.alerts.resolve"],
    actions: ["Assign alert", "Acknowledge alert", "Resolve alert", "Escalate to incident"],
    permissionHints: ["security.alerts.read", "security.alerts.manage"]
  }),
  screen({
    sequence: 84,
    id: "security-events",
    title: "Security Events Explorer",
    group: "security",
    path: "/admin/security/events",
    purpose: "Security events list and triage surface.",
    endpointIds: ["security.events.list", "security.events.status"],
    actions: ["Filter events", "Update event status", "Open event detail"],
    permissionHints: ["security.events.read", "security.events.manage"]
  }),
  screen({
    sequence: 85,
    id: "security-event-detail",
    title: "Security Event Detail",
    group: "security",
    path: "/admin/security/events/:securityEventId",
    purpose: "Detailed event investigation page.",
    endpointIds: ["security.events.detail", "security.events.status"],
    actions: ["Inspect evidence", "Change event status", "Open linked alert or incident"],
    permissionHints: ["security.events.read", "security.events.manage"]
  }),
  screen({
    sequence: 86,
    id: "security-incidents",
    title: "Incidents List",
    group: "security",
    path: "/admin/security/incidents",
    purpose: "Open incident queue and creation surface.",
    endpointIds: ["security.incidents.list", "security.incidents.create"],
    actions: ["Create incident", "Open incident detail"],
    permissionHints: ["security.incidents.read", "security.incidents.create"]
  }),
  screen({
    sequence: 87,
    id: "security-incident-detail",
    title: "Incident Detail and Investigation Workspace",
    group: "security",
    path: "/admin/security/incidents/:incidentId",
    purpose: "Incident command page for updates and closure.",
    endpointIds: ["security.incidents.detail", "security.incidents.update", "security.incidents.close"],
    actions: ["Update incident", "Close incident", "Review linked evidence"],
    permissionHints: ["security.incidents.read", "security.incidents.manage"]
  }),
  screen({
    sequence: 88,
    id: "security-risk-signals",
    title: "Risk Signals and Fraud Review",
    group: "security",
    path: "/admin/security/risk-signals",
    purpose: "Fraud-review and risk-signal investigation surface.",
    endpointIds: ["security.riskSignals", "security.riskSignals.review", "security.loginEvents"],
    actions: ["Inspect risk signal", "Mark reviewed", "Cross-check login events"],
    permissionHints: ["security.risk.read", "security.risk.review"]
  })
] as const;

const systemScreens = [
  screen({
    sequence: 89,
    id: "system-settings",
    title: "Settings Overview",
    group: "system",
    path: "/admin/system/settings",
    navLabel: "System",
    showInSidebar: true,
    purpose: "Top-level settings overview and edit surface.",
    endpointIds: ["system.settings.detail", "system.settings.update"],
    actions: ["Review settings", "Update settings"],
    permissionHints: ["settings.read", "settings.write"]
  }),
  screen({
    sequence: 90,
    id: "system-settings-checkout",
    title: "Checkout and Commerce Settings",
    group: "system",
    path: "/admin/system/settings/checkout",
    purpose: "Checkout-specific system settings workspace.",
    endpointIds: ["system.settings.checkoutDetail", "system.settings.checkoutUpdate"],
    actions: ["Review checkout settings", "Update checkout settings"],
    permissionHints: ["settings.read", "settings.write"]
  }),
  screen({
    sequence: 91,
    id: "system-settings-reviews",
    title: "Review and Moderation Settings",
    group: "system",
    path: "/admin/system/settings/reviews",
    purpose: "Review moderation-related configuration surface.",
    endpointIds: ["system.settings.reviewDetail", "system.settings.update"],
    actions: ["Review moderation settings", "Update moderation settings through settings editor"],
    permissionHints: ["settings.read", "settings.write"]
  }),
  screen({
    sequence: 92,
    id: "system-settings-support",
    title: "Support and SLA Settings",
    group: "system",
    path: "/admin/system/settings/support",
    purpose: "Support operational settings workspace.",
    endpointIds: ["system.settings.supportDetail", "system.settings.update"],
    actions: ["Review support settings", "Update support settings through settings editor"],
    permissionHints: ["settings.read", "settings.write"]
  }),
  screen({
    sequence: 93,
    id: "system-webhooks",
    title: "Webhooks Monitoring",
    group: "system",
    path: "/admin/system/webhooks",
    purpose: "Webhook event monitoring and replay surface.",
    endpointIds: ["system.webhooks.list", "system.webhooks.detail", "system.webhooks.retry"],
    actions: ["Inspect webhook detail", "Retry webhook processing"],
    permissionHints: ["integrations.webhooks.read", "integrations.webhooks.write", "system.webhooks.read", "system.webhooks.retry"]
  }),
  screen({
    sequence: 93.5,
    id: "system-webhook-detail",
    title: "Webhook event detail",
    group: "system",
    path: "/admin/system/webhooks/:webhookEventId",
    purpose: "Inspect a webhook event, attempts, and payloads; retry when permitted.",
    endpointIds: ["system.webhooks.detail", "system.webhooks.retry"],
    actions: ["Retry webhook processing", "Inspect webhook payload"],
    permissionHints: ["integrations.webhooks.read", "integrations.webhooks.write", "system.webhooks.read", "system.webhooks.retry"]
  }),
  screen({
    sequence: 94,
    id: "system-jobs",
    title: "Jobs and Background Processing Monitor",
    group: "system",
    path: "/admin/system/jobs",
    purpose: "Background job monitor and replay surface.",
    endpointIds: ["system.jobs.list", "system.jobs.detail", "system.jobs.retry"],
    actions: ["Inspect job detail", "Retry job run"],
    permissionHints: ["system.jobs.read", "system.jobs.run", "system.jobs.retry"]
  }),
  screen({
    sequence: 95,
    id: "system-job-detail",
    title: "Job run detail",
    group: "system",
    path: "/admin/system/jobs/:jobRunId",
    purpose: "Inspect a tracked job run, errors, and metadata; retry when permitted.",
    endpointIds: ["system.jobs.detail", "system.jobs.retry"],
    actions: ["Retry failed job", "Inspect error payload"],
    permissionHints: ["system.jobs.read", "system.jobs.retry"]
  }),
  screen({
    sequence: 96,
    id: "system-integrations-health",
    title: "API and Integration Health Monitor",
    group: "system",
    path: "/admin/system/integrations-health",
    purpose: "Integration health, provider status, notification failures, and exception overview.",
    endpointIds: [
      "system.integrations.health",
      "system.integrations.providers",
      "system.integrations.exceptions",
      "system.notifications.list",
      "system.notifications.detail",
      "system.notifications.retry"
    ],
    actions: ["Inspect provider health", "Review integration exceptions", "Retry failed notification"],
    permissionHints: ["system.integrations.read", "system.notifications.retry"]
  })
] as const;

export const adminScreenCatalog = [
  ...accessShellScreens,
  ...dashboardScreens,
  ...catalogScreens,
  ...inventoryScreens,
  ...orderScreens,
  ...paymentScreens,
  ...customerScreens,
  ...supportScreens,
  ...contentScreens,
  ...marketingScreens,
  ...reportScreens,
  ...securityScreens,
  ...systemScreens
] as const;

for (const screenItem of adminScreenCatalog) {
  if (stitchExportSlugByScreenId[screenItem.id] === undefined) {
    throw new Error(
      `Admin screen "${screenItem.id}" has no Stitch export mapping. Add it to stitchExportSlugByScreenId in admin-frontend/src/lib/stitch/stitch-screen-map.ts and ensure docs/admin frontend UI /stitch/<slug>/ exists.`
    );
  }
}

export const adminSidebarGroups: ReadonlyArray<{
  id: AdminScreenGroup;
  title: string;
  screens: readonly AdminScreenResolved[];
}> = [
  { id: "dashboard", title: "Overview", screens: adminScreenCatalog.filter((screenItem) => screenItem.group === "dashboard" && screenItem.showInSidebar) },
  { id: "catalog", title: "Catalog", screens: adminScreenCatalog.filter((screenItem) => screenItem.group === "catalog" && screenItem.showInSidebar) },
  { id: "inventory", title: "Inventory", screens: adminScreenCatalog.filter((screenItem) => screenItem.group === "inventory" && screenItem.showInSidebar) },
  { id: "orders", title: "Orders", screens: adminScreenCatalog.filter((screenItem) => screenItem.group === "orders" && screenItem.showInSidebar) },
  { id: "payments", title: "Payments", screens: adminScreenCatalog.filter((screenItem) => screenItem.group === "payments" && screenItem.showInSidebar) },
  { id: "customers", title: "Customers", screens: adminScreenCatalog.filter((screenItem) => screenItem.group === "customers" && screenItem.showInSidebar) },
  { id: "support", title: "Support", screens: adminScreenCatalog.filter((screenItem) => screenItem.group === "support" && screenItem.showInSidebar) },
  { id: "content", title: "Content", screens: adminScreenCatalog.filter((screenItem) => screenItem.group === "content" && screenItem.showInSidebar) },
  { id: "marketing", title: "Marketing", screens: adminScreenCatalog.filter((screenItem) => screenItem.group === "marketing" && screenItem.showInSidebar) },
  { id: "reports", title: "Reports", screens: adminScreenCatalog.filter((screenItem) => screenItem.group === "reports" && screenItem.showInSidebar) },
  { id: "security", title: "Security and Audit", screens: adminScreenCatalog.filter((screenItem) => screenItem.group === "security" && screenItem.showInSidebar) },
  { id: "system", title: "System", screens: adminScreenCatalog.filter((screenItem) => screenItem.group === "system" && screenItem.showInSidebar) }
];

export const publicAdminScreens = adminScreenCatalog.filter((screenItem) => screenItem.publicRoute);
export const protectedAdminScreens = adminScreenCatalog.filter((screenItem) => !screenItem.publicRoute);

export const adminScreenLookup = Object.fromEntries(
  adminScreenCatalog.map((screenItem) => [screenItem.id, screenItem])
) as Record<(typeof adminScreenCatalog)[number]["id"], (typeof adminScreenCatalog)[number]>;
