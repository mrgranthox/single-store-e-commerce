import { z } from "zod";

import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import { readValidatedQuery } from "../../common/validation/validate-request";
import { reportsDateRangeQuerySchema } from "./reports.schemas";
import {
  getCustomerReport,
  getDashboardReport,
  getMarketingReport,
  getPostPurchaseReport,
  getProductPerformanceReport,
  getSalesReport,
  getSupportReport
} from "./reports.service";

export const getDashboardAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof reportsDateRangeQuerySchema>>(request);
  const data = await getDashboardReport(query);
  return sendSuccess(response, { data });
});

export const getSalesAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof reportsDateRangeQuerySchema>>(request);
  const data = await getSalesReport(query);
  return sendSuccess(response, { data });
});

export const getProductsAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof reportsDateRangeQuerySchema>>(request);
  const data = await getProductPerformanceReport(query);
  return sendSuccess(response, { data });
});

export const getCustomersAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof reportsDateRangeQuerySchema>>(request);
  const data = await getCustomerReport(query);
  return sendSuccess(response, { data });
});

export const getSupportAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof reportsDateRangeQuerySchema>>(request);
  const data = await getSupportReport(query);
  return sendSuccess(response, { data });
});

export const getPostPurchaseAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof reportsDateRangeQuerySchema>>(request);
  const data = await getPostPurchaseReport(query);
  return sendSuccess(response, { data });
});

export const getMarketingAdmin = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof reportsDateRangeQuerySchema>>(request);
  const data = await getMarketingReport(query);
  return sendSuccess(response, { data });
});
