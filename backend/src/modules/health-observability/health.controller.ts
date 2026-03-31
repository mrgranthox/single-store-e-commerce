import type { RequestHandler } from "express";

import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import { getHealthSnapshot, getReadinessSnapshot } from "./health.service";

export const getHealth: RequestHandler = (_request, response) => {
  return sendSuccess(response, {
    data: getHealthSnapshot()
  });
};

export const getReadiness = asyncHandler(async (_request, response) => {
  const readiness = await getReadinessSnapshot();

  return sendSuccess(response, {
    statusCode: readiness.status === "ready" ? 200 : 503,
    data: readiness
  });
});
