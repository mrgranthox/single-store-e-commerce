import { Suspense, lazy, useEffect, type ComponentType, type LazyExoticComponent } from "react";
import { Link, Navigate, RouterProvider, createBrowserRouter, useRouteError } from "react-router-dom";

import { PublicAuthLayout } from "@/components/layout/PublicAuthLayout";
import { ProtectedAdminLayout } from "@/components/routing/ProtectedAdminLayout";
import {
  adminScreenCatalog,
  adminScreenLookup,
  protectedAdminScreens
} from "@/lib/contracts/admin-screen-catalog";
import { captureFrontendException } from "@/lib/observability/sentry";

const stripAdminPrefix = (path: string) => path.replace(/^\/admin\/?/, "");
const lazyModuleLoaders = import.meta.glob("../features/**/*.tsx");
const lazyComponentCache = new Map<string, LazyExoticComponent<ComponentType<Record<string, unknown>>>>();

const getLazyNamedComponent = (modulePath: string, exportName: string) => {
  const cacheKey = `${modulePath}:${exportName}`;
  const existing = lazyComponentCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const loader = lazyModuleLoaders[modulePath];
  if (!loader) {
    throw new Error(`Lazy route module not found: ${modulePath}`);
  }

  const component = lazy(async () => {
    const mod = (await loader()) as Record<string, unknown>;
    const namedExport = mod[exportName];
    if (typeof namedExport !== "function") {
      throw new Error(`Lazy route export not found: ${exportName} from ${modulePath}`);
    }
    return {
      default: namedExport as ComponentType<Record<string, unknown>>
    };
  });

  lazyComponentCache.set(cacheKey, component);
  return component;
};

const renderLazyRoute = (
  modulePath: string,
  exportName: string,
  props?: Record<string, unknown>
) => {
  const Component = getLazyNamedComponent(modulePath, exportName);

  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-[#e0e2f0] bg-white p-10 text-center text-sm text-[#737685]">
          Loading screen…
        </div>
      }
    >
      <Component {...(props ?? {})} />
    </Suspense>
  );
};

const RouterErrorPage = () => {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "The page could not be loaded. Refresh and try again.";

  useEffect(() => {
    captureFrontendException(error, {
      scope: "router",
      message
    });
  }, [error, message]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb] p-6">
      <div className="w-full max-w-lg rounded-2xl border border-[#e0e2f0] bg-white p-8 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#737685]">Admin workspace</p>
        <h1 className="mt-2 font-headline text-2xl font-bold tracking-tight text-[#181b25]">
          Something interrupted this screen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#5b5e68]">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/admin/dashboard"
            className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1653cc]/90"
          >
            Return to dashboard
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-[#d8dbe8] px-4 py-2 text-sm font-semibold text-[#434654] hover:bg-[#f8f9fb]"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
};

const screenRouteElement = (screenId: string) => {
  switch (screenId) {
    case "admin-profile-security":
      return renderLazyRoute("../features/auth/pages/ProfileSecurityPage.tsx", "ProfileSecurityPage");
    case "dashboard-overview":
      return renderLazyRoute("../features/dashboard/pages/DashboardOverviewPage.tsx", "DashboardOverviewPage");
    case "dashboard-sales":
      return renderLazyRoute("../features/dashboard/pages/DashboardSubPage.tsx", "DashboardSubPage", {
        segment: "sales"
      });
    case "dashboard-operations":
      return renderLazyRoute("../features/dashboard/pages/DashboardSubPage.tsx", "DashboardSubPage", {
        segment: "operations"
      });
    case "dashboard-support":
      return renderLazyRoute("../features/dashboard/pages/DashboardSubPage.tsx", "DashboardSubPage", {
        segment: "support"
      });
    case "dashboard-risk":
      return renderLazyRoute("../features/dashboard/pages/DashboardSubPage.tsx", "DashboardSubPage", {
        segment: "risk"
      });
    case "dashboard-system-health":
      return renderLazyRoute("../features/dashboard/pages/DashboardSubPage.tsx", "DashboardSubPage", {
        segment: "system-health"
      });
    case "catalog-product-list":
      return renderLazyRoute("../features/catalog/pages/ProductsListPage.tsx", "ProductsListPage");
    case "catalog-product-create":
      return renderLazyRoute("../features/catalog/pages/ProductCreatePage.tsx", "ProductCreatePage");
    case "catalog-product-detail":
      return renderLazyRoute("../features/catalog/pages/CatalogProductDetailPage.tsx", "CatalogProductDetailPage");
    case "catalog-product-edit":
      return renderLazyRoute("../features/catalog/pages/CatalogProductEditPage.tsx", "CatalogProductEditPage");
    case "catalog-product-analytics":
      return renderLazyRoute(
        "../features/catalog/pages/CatalogProductAnalyticsPage.tsx",
        "CatalogProductAnalyticsPage"
      );
    case "catalog-product-variants":
      return renderLazyRoute(
        "../features/catalog/pages/CatalogProductVariantsPage.tsx",
        "CatalogProductVariantsPage"
      );
    case "catalog-product-media":
      return renderLazyRoute("../features/catalog/pages/CatalogProductMediaPage.tsx", "CatalogProductMediaPage");
    case "catalog-product-pricing":
      return renderLazyRoute(
        "../features/catalog/pages/CatalogProductPricingPage.tsx",
        "CatalogProductPricingPage"
      );
    case "catalog-product-inventory":
      return renderLazyRoute(
        "../features/catalog/pages/CatalogProductInventoryPage.tsx",
        "CatalogProductInventoryPage"
      );
    case "catalog-categories":
      return renderLazyRoute("../features/catalog/pages/CategoriesListPage.tsx", "CategoriesListPage");
    case "catalog-category-new":
      return renderLazyRoute("../features/catalog/pages/CategoryCreatePage.tsx", "CategoryCreatePage");
    case "catalog-category-edit":
      return renderLazyRoute("../features/catalog/pages/CategoryEditPage.tsx", "CategoryEditPage");
    case "catalog-brands":
      return renderLazyRoute("../features/catalog/pages/BrandsListPage.tsx", "BrandsListPage");
    case "catalog-brand-new":
      return renderLazyRoute("../features/catalog/pages/BrandCreatePage.tsx", "BrandCreatePage");
    case "catalog-brand-edit":
      return renderLazyRoute("../features/catalog/pages/BrandEditPage.tsx", "BrandEditPage");
    case "catalog-reviews":
      return renderLazyRoute("../features/catalog/pages/CatalogReviewsListPage.tsx", "CatalogReviewsListPage");
    case "inventory-overview":
      return renderLazyRoute("../features/inventory/pages/InventoryOverviewPage.tsx", "InventoryOverviewPage");
    case "inventory-low-stock":
      return renderLazyRoute("../features/inventory/pages/InventoryQueuePage.tsx", "InventoryQueuePage", {
        mode: "low"
      });
    case "inventory-out-of-stock":
      return renderLazyRoute("../features/inventory/pages/InventoryQueuePage.tsx", "InventoryQueuePage", {
        mode: "out"
      });
    case "inventory-movements":
      return renderLazyRoute("../features/inventory/pages/InventoryMovementsPage.tsx", "InventoryMovementsPage");
    case "inventory-warehouses":
      return renderLazyRoute("../features/inventory/pages/WarehousesListPage.tsx", "WarehousesListPage");
    case "inventory-adjustments":
      return renderLazyRoute(
        "../features/inventory/pages/InventoryAdjustmentsPage.tsx",
        "InventoryAdjustmentsPage"
      );
    case "inventory-warehouse-detail":
      return renderLazyRoute("../features/inventory/pages/WarehouseDetailPage.tsx", "WarehouseDetailPage");
    case "inventory-warehouse-stock":
      return renderLazyRoute("../features/inventory/pages/WarehouseStockPage.tsx", "WarehouseStockPage");
    case "customers-list":
      return renderLazyRoute("../features/customers/pages/CustomersListPage.tsx", "CustomersListPage");
    case "customers-detail":
      return renderLazyRoute("../features/customers/pages/CustomerDetailPage.tsx", "CustomerDetailPage");
    case "customers-activity":
      return renderLazyRoute("../features/customers/pages/CustomerActivityPage.tsx", "CustomerActivityPage");
    case "customers-support":
      return renderLazyRoute("../features/customers/pages/CustomerSupportPage.tsx", "CustomerSupportPage");
    case "customers-reviews":
      return renderLazyRoute("../features/customers/pages/CustomerReviewsPage.tsx", "CustomerReviewsPage");
    case "customers-risk":
      return renderLazyRoute("../features/customers/pages/CustomerRiskPage.tsx", "CustomerRiskPage");
    case "customers-actions":
      return renderLazyRoute("../features/customers/pages/CustomerActionsPage.tsx", "CustomerActionsPage");
    case "support-tickets":
      return renderLazyRoute("../features/support/pages/SupportTicketsListPage.tsx", "SupportTicketsListPage");
    case "support-ticket-detail":
      return renderLazyRoute(
        "../features/support/pages/SupportTicketDetailPage.tsx",
        "SupportTicketDetailPage"
      );
    case "support-sla-queue":
      return renderLazyRoute("../features/support/pages/SupportQueuePage.tsx", "SupportQueuePage", {
        mode: "sla"
      });
    case "support-pre-purchase":
      return renderLazyRoute("../features/support/pages/SupportQueuePage.tsx", "SupportQueuePage", {
        mode: "prePurchase"
      });
    case "support-complaints":
      return renderLazyRoute("../features/support/pages/SupportQueuePage.tsx", "SupportQueuePage", {
        mode: "complaints"
      });
    case "support-analytics":
      return renderLazyRoute("../features/support/pages/SupportAnalyticsPage.tsx", "SupportAnalyticsPage");
    case "payments-list":
      return renderLazyRoute("../features/payments/pages/PaymentsListPage.tsx", "PaymentsListPage");
    case "payments-detail":
      return renderLazyRoute("../features/payments/pages/PaymentDetailPage.tsx", "PaymentDetailPage");
    case "payments-transactions":
      return renderLazyRoute(
        "../features/payments/pages/PaymentTransactionsPage.tsx",
        "PaymentTransactionsPage"
      );
    case "payments-failed-investigations":
      return renderLazyRoute(
        "../features/payments/pages/PaymentsFailedInvestigationsPage.tsx",
        "PaymentsFailedInvestigationsPage"
      );
    case "finance-exceptions":
      return renderLazyRoute("../features/payments/pages/FinanceExceptionsPage.tsx", "FinanceExceptionsPage");
    case "orders-list":
      return renderLazyRoute("../features/orders/pages/OrdersListPage.tsx", "OrdersListPage");
    case "orders-detail":
      return renderLazyRoute("../features/orders/pages/OrderDetailPage.tsx", "OrderDetailPage");
    case "orders-timeline":
      return renderLazyRoute("../features/orders/pages/OrderTimelinePage.tsx", "OrderTimelinePage");
    case "orders-fulfillment-queue":
      return renderLazyRoute("../features/orders/pages/OrderQueuesPage.tsx", "OrderQueuesPage", {
        mode: "fulfillment"
      });
    case "orders-dispatch-queue":
      return renderLazyRoute("../features/orders/pages/OrderQueuesPage.tsx", "OrderQueuesPage", {
        mode: "dispatch"
      });
    case "orders-cancellation-requests":
      return renderLazyRoute(
        "../features/orders/pages/CancellationRequestsPage.tsx",
        "CancellationRequestsPage"
      );
    case "shipments-hub":
      return renderLazyRoute("../features/orders/pages/ShipmentsHubPage.tsx", "ShipmentsHubPage");
    case "shipments-detail":
      return renderLazyRoute("../features/orders/pages/ShipmentDetailPage.tsx", "ShipmentDetailPage");
    case "shipments-tracking":
      return renderLazyRoute("../features/orders/pages/ShipmentTrackingPage.tsx", "ShipmentTrackingPage");
    case "returns-queue":
      return renderLazyRoute("../features/returns/pages/ReturnsListPage.tsx", "ReturnsListPage");
    case "returns-detail":
      return renderLazyRoute("../features/returns/pages/ReturnDetailPage.tsx", "ReturnDetailPage");
    case "refunds-queue":
      return renderLazyRoute("../features/refunds/pages/RefundsListPage.tsx", "RefundsListPage");
    case "refunds-detail":
      return renderLazyRoute("../features/refunds/pages/RefundDetailPage.tsx", "RefundDetailPage");
    case "customers-orders":
      return renderLazyRoute("../features/customers/pages/CustomerOrdersPage.tsx", "CustomerOrdersPage");
    case "security-alerts":
      return renderLazyRoute("../features/security/pages/AlertsListPage.tsx", "AlertsListPage");
    case "security-alert-detail":
      return renderLazyRoute("../features/security/pages/AlertDetailPage.tsx", "AlertDetailPage");
    case "security-audit-logs":
      return renderLazyRoute("../features/security/pages/AuditLogsPage.tsx", "AuditLogsPage");
    case "security-admin-actions":
      return renderLazyRoute("../features/security/pages/AdminActionLogsPage.tsx", "AdminActionLogsPage");
    case "security-incidents":
      return renderLazyRoute("../features/security/pages/IncidentsListPage.tsx", "IncidentsListPage");
    case "security-incident-detail":
      return renderLazyRoute("../features/security/pages/IncidentDetailPage.tsx", "IncidentDetailPage");
    case "security-user-activity":
      return renderLazyRoute(
        "../features/security/pages/SecurityUserActivityPage.tsx",
        "SecurityUserActivityPage"
      );
    case "security-events":
      return renderLazyRoute("../features/security/pages/SecurityEventsListPage.tsx", "SecurityEventsListPage");
    case "security-event-detail":
      return renderLazyRoute(
        "../features/security/pages/SecurityEventDetailPage.tsx",
        "SecurityEventDetailPage"
      );
    case "security-risk-signals":
      return renderLazyRoute(
        "../features/security/pages/SecurityRiskSignalsPage.tsx",
        "SecurityRiskSignalsPage"
      );
    case "reports-overview":
      return renderLazyRoute("../features/reports/pages/ReportsOverviewPage.tsx", "ReportsOverviewPage");
    case "reports-sales":
      return renderLazyRoute("../features/reports/pages/ReportDatasetPage.tsx", "ReportDatasetPage", {
        segment: "sales",
        title: "Sales report",
        description: "Revenue, orders, and gross vs net trend for the selected range."
      });
    case "reports-products":
      return renderLazyRoute("../features/reports/pages/ReportDatasetPage.tsx", "ReportDatasetPage", {
        segment: "products",
        title: "Product performance report",
        description: "Top products, units, and revenue concentration."
      });
    case "reports-inventory":
      return renderLazyRoute("../features/reports/pages/ReportDatasetPage.tsx", "ReportDatasetPage", {
        segment: "inventory",
        title: "Inventory report",
        description: "Warehouse health, in-stock rates, and low-stock watchlist."
      });
    case "reports-customers":
      return renderLazyRoute("../features/reports/pages/ReportDatasetPage.tsx", "ReportDatasetPage", {
        segment: "customers",
        title: "Customer report",
        description: "Customer totals, risk flags, and top accounts by spend."
      });
    case "reports-support":
      return renderLazyRoute("../features/reports/pages/ReportDatasetPage.tsx", "ReportDatasetPage", {
        segment: "support",
        title: "Support report",
        description: "Ticket volume, priority mix, SLA watchlist, and categories."
      });
    case "reports-refunds-returns":
      return renderLazyRoute("../features/reports/pages/ReportDatasetPage.tsx", "ReportDatasetPage", {
        segment: "refunds-returns",
        title: "Refunds & returns report",
        description: "Refund amounts, return pipeline, and review moderation snapshot."
      });
    case "reports-marketing":
      return renderLazyRoute("../features/reports/pages/ReportDatasetPage.tsx", "ReportDatasetPage", {
        segment: "marketing",
        title: "Marketing report",
        description: "Coupons, promotions, campaigns, and redemption activity."
      });
    case "system-settings":
      return renderLazyRoute("../features/system/pages/SystemSettingsPage.tsx", "SystemSettingsPage");
    case "system-settings-checkout":
      return renderLazyRoute(
        "../features/system/pages/SystemSettingsScopedPage.tsx",
        "SystemSettingsScopedPage",
        {
          scope: "checkout",
          title: "Checkout & Commerce Settings",
          description: "Configure transactional logic, tax frameworks, and order lifecycle parameters.",
          eyebrow: ["System Architecture", "Commerce Configuration"]
        }
      );
    case "system-settings-reviews":
      return renderLazyRoute(
        "../features/system/pages/SystemSettingsScopedPage.tsx",
        "SystemSettingsScopedPage",
        {
          scope: "reviews",
          title: "Review & Moderation Settings",
          description: "Configure automated workflows and gatekeeping for customer generated content.",
          eyebrow: ["Trust & Safety", "Moderation"]
        }
      );
    case "system-settings-support":
      return renderLazyRoute(
        "../features/system/pages/SystemSettingsScopedPage.tsx",
        "SystemSettingsScopedPage",
        {
          scope: "support",
          title: "Support & SLA Settings",
          description: "Architect system-wide response thresholds and routing protocols.",
          eyebrow: ["Operations", "Support & SLA"]
        }
      );
    case "system-jobs":
      return renderLazyRoute("../features/system/pages/JobsListPage.tsx", "JobsListPage");
    case "system-job-detail":
      return renderLazyRoute("../features/system/pages/JobDetailPage.tsx", "JobDetailPage");
    case "system-webhooks":
      return renderLazyRoute("../features/system/pages/WebhooksListPage.tsx", "WebhooksListPage");
    case "system-webhook-detail":
      return renderLazyRoute("../features/system/pages/WebhookDetailPage.tsx", "WebhookDetailPage");
    case "system-integrations-health":
      return renderLazyRoute(
        "../features/system/pages/IntegrationsHealthPage.tsx",
        "IntegrationsHealthPage"
      );
    case "marketing-coupons":
      return renderLazyRoute("../features/marketing/pages/CouponsListPage.tsx", "CouponsListPage");
    case "marketing-coupon-analytics":
      return renderLazyRoute(
        "../features/marketing/pages/CouponAnalyticsPage.tsx",
        "CouponAnalyticsPage"
      );
    case "marketing-promotions":
      return renderLazyRoute(
        "../features/marketing/pages/PromotionsListPage.tsx",
        "PromotionsListPage"
      );
    case "marketing-promotion-rules-hub":
      return renderLazyRoute(
        "../features/marketing/pages/PromotionRulesHubPage.tsx",
        "PromotionRulesHubPage"
      );
    case "marketing-promotion-rules":
      return renderLazyRoute("../features/marketing/pages/PromotionRulesPage.tsx", "PromotionRulesPage");
    case "marketing-campaign-performance":
      return renderLazyRoute(
        "../features/marketing/pages/CampaignPerformancePage.tsx",
        "CampaignPerformancePage"
      );
    case "content-banners":
      return renderLazyRoute("../features/content/pages/BannersListPage.tsx", "BannersListPage");
    case "content-pages":
      return renderLazyRoute("../features/content/pages/ContentPagesListPage.tsx", "ContentPagesListPage");
    default: {
      const screen = adminScreenCatalog.find((screenItem) => screenItem.id === screenId);
      return screen ? (
        renderLazyRoute("../features/admin-surface/AdminSurfacePage.tsx", "AdminSurfacePage", {
          screenId: screen.id as keyof typeof adminScreenLookup
        })
      ) : (
        renderLazyRoute("../features/auth/pages/ForbiddenPage.tsx", "ForbiddenPage")
      );
    }
  }
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/admin/dashboard" replace />,
    errorElement: <RouterErrorPage />
  },
  {
    element: <PublicAuthLayout />,
    errorElement: <RouterErrorPage />,
    children: [
      {
        path: "/admin/login",
        element: renderLazyRoute("../features/auth/pages/LoginPage.tsx", "LoginPage")
      },
      {
        path: "/admin/forgot-password",
        element: renderLazyRoute("../features/auth/pages/ForgotPasswordPage.tsx", "ForgotPasswordPage")
      },
      {
        path: "/admin/reset-password",
        element: renderLazyRoute("../features/auth/pages/ResetPasswordPage.tsx", "ResetPasswordPage")
      },
      {
        path: "/admin/forbidden",
        element: renderLazyRoute("../features/auth/pages/ForbiddenPage.tsx", "ForbiddenPage")
      }
    ]
  },
  {
    path: "/admin",
    element: <ProtectedAdminLayout />,
    errorElement: <RouterErrorPage />,
    children: [
      {
        index: true,
        element: <Navigate to="dashboard" replace />
      },
      ...protectedAdminScreens.map((screenItem) => ({
        path: stripAdminPrefix(screenItem.path),
        element: screenRouteElement(screenItem.id)
      }))
    ]
  },
  {
    path: "*",
    element: <Navigate to="/admin/forbidden" replace />,
    errorElement: <RouterErrorPage />
  }
]);

export const AppRouter = () => (
  <RouterProvider
    router={router}
    future={{
      v7_startTransition: true
    }}
  />
);
