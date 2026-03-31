import { frontendEnv } from "@/lib/config/env";

export type AdminRuntimeConfig = {
  surface: "admin";
  version: string;
  api: {
    baseUrl: string;
    restBasePath: string;
    versionedBasePath: string;
  };
  auth: {
    provider: string;
    clerkPublishableKey: string | null;
    accessTokenHeader: string;
    accessTokenPrefix: string;
  };
  payments: {
    provider: string;
    defaultCurrency: string;
    allowedChannels: string[];
  };
  storage: {
    provider: string;
    signedUploadsOnly: boolean;
    productMedia: {
      allowedFormats: string[];
      maxBytes: number;
    };
    bannerMedia: {
      allowedFormats: string[];
      maxBytes: number;
    };
    supportAttachments: {
      allowedFormats: string[];
      maxBytes: number;
    };
  };
  routes: {
    auth: {
      login: string;
      refresh: string;
      forgotPassword: string;
      resetPassword: string;
      me: string;
      sessions: string;
      logout: string;
    };
    reports: {
      overview: string;
      sales: string;
      inventory: string;
      customers: string;
      support: string;
      postPurchase: string;
      marketing: string;
    };
    media: {
      catalogUploadIntent: string;
      contentUploadIntent: string;
    };
  };
};

const readWindowOrigin = () => {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:4000";
  }

  return window.location.origin;
};

export const resolveBackendBaseUrl = () =>
  frontendEnv.backendBaseUrl || readWindowOrigin();

export const fetchAdminRuntimeConfig = async (
  backendBaseUrl = resolveBackendBaseUrl()
): Promise<AdminRuntimeConfig> => {
  const response = await fetch(new URL("/api/client-config/admin", backendBaseUrl), {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load admin runtime config: ${response.status}`);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: AdminRuntimeConfig;
  };

  if (payload.success !== true || !payload.data) {
    throw new Error("Admin runtime config response did not match the expected contract.");
  }

  return payload.data;
};
