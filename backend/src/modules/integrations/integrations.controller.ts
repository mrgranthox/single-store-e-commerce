import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  getIntegrationExceptions,
  getIntegrationHealth,
  getIntegrationProviders
} from "./integrations.service";

export const getIntegrationHealthAdmin = asyncHandler(async (_request, response) => {
  const data = await getIntegrationHealth();
  return sendSuccess(response, { data });
});

export const getIntegrationProvidersAdmin = asyncHandler(async (_request, response) => {
  const data = await getIntegrationProviders();
  return sendSuccess(response, { data });
});

export const getIntegrationExceptionsAdmin = asyncHandler(async (_request, response) => {
  const data = await getIntegrationExceptions();
  return sendSuccess(response, { data });
});
