export type MobileRuntimeConfig = {
  surface: "mobile";
  api: {
    baseUrl: string;
    restBasePath: string;
  };
  routes: {
    support: {
      contactPath: string;
      productInquiryPathTemplate: string;
      abuseChallenge: {
        enabled: boolean;
        provider: string;
        siteKey: string | null;
        tokenField: string;
        supportedActions: string[];
      };
    };
  };
};

export const fetchMobileRuntimeConfig = async (backendBaseUrl: string) => {
  const response = await fetch(new URL("/api/client-config/mobile", backendBaseUrl));

  if (!response.ok) {
    throw new Error(`Failed to load mobile runtime config: ${response.status}`);
  }

  const payload = (await response.json()) as {
    success: true;
    data: MobileRuntimeConfig;
  };

  return payload.data;
};
