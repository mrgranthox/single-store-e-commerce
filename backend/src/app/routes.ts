import type { Express, RequestHandler } from "express";

import { sendSuccess } from "../common/http/response";
import { accountRouteModule } from "../modules/account/account.routes";
import { adminCompatRouteModule } from "../modules/admin-compat/admin-compat.routes";
import { adminAuthRouteModule } from "../modules/auth/admin-auth.routes";
import { customerAuthRouteModule } from "../modules/auth/customer-auth.routes";
import { alertsIncidentsRouteModule } from "../modules/alerts-incidents/alerts-incidents.routes";
import { auditRouteModule } from "../modules/audit/audit.routes";
import { catalogRouteModule } from "../modules/catalog/catalog.routes";
import { cartRouteModule } from "../modules/cart/cart.routes";
import { checkoutRouteModule } from "../modules/checkout/checkout.routes";
import { clientConfigRouteModule } from "../modules/client-config/client-config.routes";
import { customersRouteModule } from "../modules/customers/customers.routes";
import { customerCompatRouteModule } from "../modules/customer-compat/customer-compat.routes";
import { healthRouteModule } from "../modules/health-observability/health.routes";
import { inventoryRouteModule } from "../modules/inventory/inventory.routes";
import { integrationsRouteModule } from "../modules/integrations/integrations.routes";
import { jobsRouteModule } from "../modules/jobs-workers/jobs.routes";
import { marketingRouteModule } from "../modules/marketing/marketing.routes";
import { notificationsRouteModule } from "../modules/notifications/notifications.routes";
import { ordersRouteModule } from "../modules/orders/orders.routes";
import { paymentsRouteModule } from "../modules/payments/payments.routes";
import { reportsRouteModule } from "../modules/reports/reports.routes";
import { reviewsRouteModule } from "../modules/reviews/reviews.routes";
import { returnsRouteModule } from "../modules/returns/returns.routes";
import { securityRouteModule } from "../modules/security/security.routes";
import { shippingRouteModule } from "../modules/shipping/shipping.routes";
import { supportRouteModule } from "../modules/support/support.routes";
import { contentRouteModule } from "../modules/content/content.routes";
import { systemSettingsRouteModule } from "../modules/system-settings/system-settings.routes";
import { storefrontCompatRouteModule } from "../modules/storefront-compat/storefront-compat.routes";
import { wishlistRouteModule } from "../modules/wishlist/wishlist.routes";

const routeModules = [
  healthRouteModule,
  customerAuthRouteModule,
  accountRouteModule,
  adminCompatRouteModule,
  adminAuthRouteModule,
  alertsIncidentsRouteModule,
  auditRouteModule,
  catalogRouteModule,
  cartRouteModule,
  checkoutRouteModule,
  clientConfigRouteModule,
  contentRouteModule,
  customerCompatRouteModule,
  customersRouteModule,
  inventoryRouteModule,
  integrationsRouteModule,
  ordersRouteModule,
  marketingRouteModule,
  notificationsRouteModule,
  paymentsRouteModule,
  reportsRouteModule,
  reviewsRouteModule,
  returnsRouteModule,
  securityRouteModule,
  shippingRouteModule,
  supportRouteModule,
  systemSettingsRouteModule,
  storefrontCompatRouteModule,
  wishlistRouteModule,
  jobsRouteModule
];

export const routeCatalog = routeModules.flatMap((module) => module.metadata);

const rootHandler: RequestHandler = (_request, response) => {
  return sendSuccess(response, {
    data: {
      service: "ecommerce-backend",
      version: "0.1.0"
    }
  });
};

export const registerRoutes = (application: Express) => {
  application.use("/", healthRouteModule.router);
  application.get("/", rootHandler);

  const nonHealthRouteModules = routeModules.filter((module) => module !== healthRouteModule);

  for (const prefix of ["/api/v1", "/api"]) {
    for (const routeModule of nonHealthRouteModules) {
      application.use(prefix, routeModule.router);
    }
    application.use(prefix, healthRouteModule.router);
  }
};
