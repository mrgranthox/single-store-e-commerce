import { authRequiredError, forbiddenError } from "../errors/app-error";

export const requireCustomerUserId = (userId: string | undefined): string => {
  if (!userId) {
    throw authRequiredError("A verified customer session is required.");
  }

  return userId;
};

export const requireAdminUserId = (adminUserId: string | undefined): string => {
  if (!adminUserId) {
    throw forbiddenError("Admin actor required.");
  }

  return adminUserId;
};
