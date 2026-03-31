import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { getHealth, getReadiness } from "./health.controller";

const router = Router();

router.get("/health", getHealth);
router.get("/ready", getReadiness);

export const healthRouteModule: RouteModule = {
  router,
  metadata: [
    {
      method: "GET",
      path: "/api/v1/health",
      summary: "Liveness probe for the backend process.",
      tags: ["health-observability"],
      auth: "public"
    },
    {
      method: "GET",
      path: "/api/v1/ready",
      summary: "Readiness probe for the backend and its critical dependencies.",
      tags: ["health-observability"],
      auth: "public"
    }
  ]
};
