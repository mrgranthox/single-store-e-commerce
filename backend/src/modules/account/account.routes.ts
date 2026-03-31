import { Router } from "express";

import type { RouteModule } from "../../app/route.types";
import { validateRequest } from "../../common/validation/validate-request";
import { requireCustomerActor } from "../auth/auth.middleware";
import {
  accountPrivacyAnonymizeBodySchema,
  accountPreferencesBodySchema,
  accountProfileBodySchema,
  accountSessionIdParamsSchema,
  addressBodySchema,
  addressIdParamsSchema,
  changePasswordBodySchema,
  defaultAddressBodySchema,
  updateAddressBodySchema
} from "./account.schemas";
import {
  deleteAddress,
  deleteSecuritySession,
  getAccountOverview,
  getAddresses,
  getPreferences,
  getProfile,
  getPrivacyExport,
  getSecurity,
  getSecuritySessions,
  patchAddress,
  patchPreferences,
  patchProfile,
  postAddress,
  postChangePassword,
  postDefaultAddress,
  postPrivacyAnonymize
} from "./account.controller";

const router = Router();

router.get("/account", requireCustomerActor, getAccountOverview);
router.get("/account/profile", requireCustomerActor, getProfile);
router.patch("/account/profile", requireCustomerActor, validateRequest({ body: accountProfileBodySchema }), patchProfile);
router.get("/account/preferences", requireCustomerActor, getPreferences);
router.patch(
  "/account/preferences",
  requireCustomerActor,
  validateRequest({ body: accountPreferencesBodySchema }),
  patchPreferences
);
router.get("/account/addresses", requireCustomerActor, getAddresses);
router.post("/account/addresses", requireCustomerActor, validateRequest({ body: addressBodySchema }), postAddress);
router.patch(
  "/account/addresses/:addressId",
  requireCustomerActor,
  validateRequest({ params: addressIdParamsSchema, body: updateAddressBodySchema }),
  patchAddress
);
router.delete(
  "/account/addresses/:addressId",
  requireCustomerActor,
  validateRequest({ params: addressIdParamsSchema }),
  deleteAddress
);
router.post(
  "/account/addresses/:addressId/default",
  requireCustomerActor,
  validateRequest({ params: addressIdParamsSchema, body: defaultAddressBodySchema }),
  postDefaultAddress
);
router.get("/account/security", requireCustomerActor, getSecurity);
router.get("/account/security/sessions", requireCustomerActor, getSecuritySessions);
router.delete(
  "/account/security/sessions/:sessionId",
  requireCustomerActor,
  validateRequest({ params: accountSessionIdParamsSchema }),
  deleteSecuritySession
);
router.post(
  "/account/security/change-password",
  requireCustomerActor,
  validateRequest({ body: changePasswordBodySchema }),
  postChangePassword
);
router.get("/account/privacy/export", requireCustomerActor, getPrivacyExport);
router.post(
  "/account/privacy/anonymize",
  requireCustomerActor,
  validateRequest({ body: accountPrivacyAnonymizeBodySchema }),
  postPrivacyAnonymize
);

export const accountRouteModule: RouteModule = {
  router,
  metadata: [
    { method: "GET", path: "/api/v1/account", summary: "Return the authenticated customer's account dashboard payload.", tags: ["account"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/profile", summary: "Return the authenticated customer's profile.", tags: ["account"], auth: "authenticated" },
    { method: "PATCH", path: "/api/v1/account/profile", summary: "Update the authenticated customer's profile.", tags: ["account"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/preferences", summary: "Return the authenticated customer's communication preferences.", tags: ["account"], auth: "authenticated" },
    { method: "PATCH", path: "/api/v1/account/preferences", summary: "Update the authenticated customer's communication preferences.", tags: ["account"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/addresses", summary: "List the authenticated customer's saved addresses.", tags: ["account"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/account/addresses", summary: "Create a saved customer address.", tags: ["account"], auth: "authenticated" },
    { method: "PATCH", path: "/api/v1/account/addresses/:addressId", summary: "Update a saved customer address.", tags: ["account"], auth: "authenticated" },
    { method: "DELETE", path: "/api/v1/account/addresses/:addressId", summary: "Delete a saved customer address.", tags: ["account"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/account/addresses/:addressId/default", summary: "Set a saved customer address as default shipping or billing.", tags: ["account"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/security", summary: "Return the authenticated customer's security summary.", tags: ["account"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/security/sessions", summary: "List the authenticated customer's sessions.", tags: ["account"], auth: "authenticated" },
    { method: "DELETE", path: "/api/v1/account/security/sessions/:sessionId", summary: "Revoke a customer session.", tags: ["account"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/account/security/change-password", summary: "Change the authenticated customer's password through Clerk.", tags: ["account"], auth: "authenticated" },
    { method: "GET", path: "/api/v1/account/privacy/export", summary: "Export the authenticated customer's privacy bundle.", tags: ["account"], auth: "authenticated" },
    { method: "POST", path: "/api/v1/account/privacy/anonymize", summary: "Anonymize the authenticated customer's retained account data.", tags: ["account"], auth: "authenticated" }
  ]
};
