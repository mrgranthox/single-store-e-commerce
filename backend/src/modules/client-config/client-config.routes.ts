import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import {
  getAdminClientConfig,
  getCustomerClientConfig,
  getMobileClientConfig
} from "./client-config.controller";

const router = Router();

router.get("/client-config/customer", getCustomerClientConfig);
router.get("/client-config/mobile", getMobileClientConfig);
router.get("/client-config/admin", getAdminClientConfig);

export const clientConfigRouteModule: RouteModule = {
  router,
  metadata: [
    {
      method: "GET",
      path: "/api/v1/client-config/customer",
      summary: "Fetch runtime configuration for the customer frontend.",
      tags: ["client-config"],
      auth: "public"
    },
    {
      method: "GET",
      path: "/api/v1/client-config/mobile",
      summary: "Fetch runtime configuration for the mobile frontend.",
      tags: ["client-config"],
      auth: "public"
    },
    {
      method: "GET",
      path: "/api/v1/client-config/admin",
      summary: "Fetch runtime configuration for the admin frontend.",
      tags: ["client-config"],
      auth: "public"
    }
  ]
};
