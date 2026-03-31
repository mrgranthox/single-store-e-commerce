import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import { getClientConfig } from "./client-config.service";

export const getCustomerClientConfig = asyncHandler(async (_request, response) => {
  return sendSuccess(response, {
    data: getClientConfig("customer")
  });
});

export const getMobileClientConfig = asyncHandler(async (_request, response) => {
  return sendSuccess(response, {
    data: getClientConfig("mobile")
  });
});

export const getAdminClientConfig = asyncHandler(async (_request, response) => {
  return sendSuccess(response, {
    data: getClientConfig("admin")
  });
});
