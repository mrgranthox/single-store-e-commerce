export type CustomerRuntimeConfig = {
  surface: "customer";
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

export const fetchCustomerRuntimeConfig = async (backendBaseUrl: string) => {
  const response = await fetch(new URL("/api/client-config/customer", backendBaseUrl));

  if (!response.ok) {
    throw new Error(`Failed to load customer runtime config: ${response.status}`);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: CustomerRuntimeConfig;
  };

  if (payload.success !== true || !payload.data) {
    throw new Error("Customer runtime config response did not match the expected contract.");
  }

  return payload.data;
};
