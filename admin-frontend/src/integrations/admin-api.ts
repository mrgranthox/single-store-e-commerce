import { apiRequest } from "@/lib/api/http";
import { adminEndpointCatalog } from "@/lib/contracts/admin-endpoints";

type AdminApiClientInput = {
  backendBaseUrl: string;
  accessToken: string;
};

export const createAdminApiClient = (input: AdminApiClientInput) => ({
  getReportsOverview: async () =>
    apiRequest({
      backendBaseUrl: input.backendBaseUrl,
      path: "/api/admin/reports/overview",
      accessToken: input.accessToken
    }),
  createCatalogUploadIntent: async (productId: string, body: Record<string, unknown>) =>
    apiRequest({
      backendBaseUrl: input.backendBaseUrl,
      path: `/api/admin/catalog/products/${encodeURIComponent(productId)}/media/upload-intents`,
      method: "POST",
      accessToken: input.accessToken,
      body
    }),
  createContentUploadIntent: async (body: Record<string, unknown>) =>
    apiRequest({
      backendBaseUrl: input.backendBaseUrl,
      path: "/api/admin/content/media/upload-intents",
      method: "POST",
      accessToken: input.accessToken,
      body
    }),
  listEndpointCatalog: () => adminEndpointCatalog
});
