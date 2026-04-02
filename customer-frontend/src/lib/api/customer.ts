import { getCustomerScreen } from "@/lib/contracts/customer-screen-catalog";
import { campaigns, faqItems, featuredProducts, orders, pages, tickets } from "@/lib/data/customer-mock";
import { fetchCustomerRuntimeConfig } from "@/integrations/backend-config";
import { submitProductInquiry, submitSupportContact } from "@/integrations/support";

const backendBaseUrl =
  import.meta.env.VITE_BACKEND_BASE_URL?.trim() || window.location.origin;

type ApiEnvelope<T> = { success: true; data: T };

const readJson = async <T>(response: Response) => {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || payload.success !== true) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return payload.data;
};

const safeFetch = async <T>(input: RequestInfo | URL, fallback: T) => {
  try {
    const response = await fetch(input, { headers: { accept: "application/json" } });
    return await readJson<T>(response);
  } catch {
    return fallback;
  }
};

export const customerApi = {
  getRuntimeConfig: async () => {
    try {
      return await fetchCustomerRuntimeConfig(backendBaseUrl);
    } catch {
      return {
        surface: "customer" as const,
        api: { baseUrl: backendBaseUrl, restBasePath: "/api" },
        routes: {
          support: {
            contactPath: "/api/support/contact",
            productInquiryPathTemplate: "/api/products/:slug/questions",
            abuseChallenge: {
              enabled: false,
              provider: "none",
              siteKey: null,
              tokenField: "captchaToken",
              supportedActions: []
            }
          }
        }
      };
    }
  },
  getProducts: (search?: string) => {
    const filtered = search
      ? featuredProducts.filter((product) =>
          `${product.name} ${product.category} ${product.brand}`.toLowerCase().includes(search.toLowerCase())
        )
      : featuredProducts;
    return safeFetch(
      new URL(`/api/products${search ? `?query=${encodeURIComponent(search)}` : ""}`, backendBaseUrl),
      filtered
    );
  },
  getProduct: async (slug: string) => {
    const fallback = featuredProducts.find((product) => product.slug === slug) ?? featuredProducts[0];
    return safeFetch(new URL(`/api/products/${slug}`, backendBaseUrl), fallback);
  },
  getOrders: () => safeFetch(new URL("/api/account/orders", backendBaseUrl), orders),
  getOrder: async (orderId: string) => {
    const fallback = orders.find((order) => order.id === orderId) ?? orders[0];
    return safeFetch(new URL(`/api/account/orders/${orderId}`, backendBaseUrl), fallback);
  },
  getTickets: () => safeFetch(new URL("/api/account/support/tickets", backendBaseUrl), tickets),
  getTicket: async (ticketId: string) => {
    const fallback = tickets.find((ticket) => ticket.id === ticketId) ?? tickets[0];
    return safeFetch(new URL(`/api/account/support/tickets/${ticketId}`, backendBaseUrl), fallback);
  },
  getFaq: async () => faqItems,
  getCampaign: async (slug: string) => campaigns.find((campaign) => campaign.slug === slug) ?? campaigns[0],
  getPageContent: async (slug: keyof typeof pages) => pages[slug],
  getScreenMeta: async (screenId: Parameters<typeof getCustomerScreen>[0]) => getCustomerScreen(screenId),
  submitSupportContact: (payload: Parameters<typeof submitSupportContact>[0]) => submitSupportContact(payload),
  submitProductInquiry: (payload: Parameters<typeof submitProductInquiry>[0]) => submitProductInquiry(payload)
};
