import { getCustomerScreen } from "@/lib/contracts/customer-screen-catalog";
import { fetchCustomerRuntimeConfig } from "@/integrations/backend-config";
import { submitProductInquiry, submitSupportContact } from "@/integrations/support";
import { commerceFetchJson, getBackendBaseUrl, resolveCommerceUrl } from "@/lib/api/commerce-fetch";
import { customerBackendApi } from "@/lib/api/customer-backend-api";

export type HomepageProductCard = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  rating?: number;
  reviewCount?: number;
  description?: string;
  brand?: string;
  defaultVariantId?: string | null;
};

export type CustomerHomepagePayload = {
  hero: {
    eyebrow: string;
    titlePrefix: string;
    titleAccent: string | null;
    titleSuffix: string | null;
    body: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    backgroundImageUrl: string;
    backgroundImageAlt: string;
  };
  trustBadges: Array<{
    iconName: string;
    title: string;
    subtitle: string;
    href: string | null;
    ariaLabel: string | null;
  }>;
  categorySection: {
    isVisible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    items: Array<{
      slug: string;
      title: string;
      description: string;
      imageUrl: string;
      productCount: number;
      href: string;
    }>;
  };
  featuredSection: {
    isVisible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    items: HomepageProductCard[];
  };
  brandSection: {
    isVisible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    items: Array<{
      slug: string;
      title: string;
      tagline: string;
      heroImageUrl: string;
      ctaLabel: string;
      href: string;
      products: HomepageProductCard[];
    }>;
  };
  campaignSection: {
    isVisible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    items: Array<{
      slug: string;
      title: string;
      subtitle: string;
      heroImageUrl: string;
      label: string;
      ctaLabel: string;
      href: string;
      layout: "FEATURE" | "SPLIT";
      products: HomepageProductCard[];
    }>;
  };
  promoSection: {
    isVisible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    items: Array<{
      badge: string;
      code: string;
      headline: string;
      body: string;
      terms: string;
      bannerImageUrl: string;
      ctaLabel: string;
      ctaHref: string;
      products: HomepageProductCard[];
    }>;
  };
  testimonialSection: {
    isVisible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    items: Array<{
      quote: string;
      customerName: string;
      imageUrl: string;
      statusLabel: string;
    }>;
  };
};

const readHomepageEntity = async () => {
  const response = await fetch(resolveCommerceUrl("/api/content/homepage"), {
    headers: { accept: "application/json" },
    cache: "no-store"
  });
  const payload = (await response.json()) as { success?: boolean; data?: { entity: CustomerHomepagePayload } };
  if (!response.ok || payload.success !== true || !payload.data?.entity) {
    throw new Error(`Homepage request failed with status ${response.status}`);
  }
  return payload.data.entity;
};

export const customerApi = {
  getHomepage: async () => ({ entity: await readHomepageEntity() }),

  getRuntimeConfig: async () => {
    const base = getBackendBaseUrl();
    if (!base) {
      return {
        surface: "customer" as const,
        api: { baseUrl: "", restBasePath: "/api" },
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
    try {
      return await fetchCustomerRuntimeConfig(base);
    } catch {
      return {
        surface: "customer" as const,
        api: { baseUrl: base, restBasePath: "/api" },
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

  getProducts: async (search?: string) => {
    const { data } = await customerBackendApi.listProducts({
      query: search,
      page: 1,
      page_size: 48
    });
    return data;
  },

  getProduct: async (slug: string) => {
    const { data } = await customerBackendApi.getProduct(slug);
    return data;
  },

  getOrders: async () => {
    const { data } = await customerBackendApi.listOrders({ page: 1, page_size: 50 });
    return data;
  },

  getOrder: async (orderId: string) => {
    const { data } = await customerBackendApi.getOrder(orderId);
    return data;
  },

  getTickets: async () => {
    const { data } = await customerBackendApi.listSupportTickets({ page: 1, page_size: 50 });
    return data;
  },

  getTicket: async (ticketId: string) => {
    const { data } = await customerBackendApi.getSupportTicket(ticketId);
    return data;
  },

  getFaq: async () => {
    const { data } = await commerceFetchJson<unknown>("/api/help", { method: "GET" });
    return data;
  },

  getCampaign: async (slug: string) => {
    const { data } = await customerBackendApi.getCampaign(slug);
    return data;
  },

  getPageContent: async (slug: string) => {
    const { data } = await customerBackendApi.getPage(slug);
    return data;
  },

  getScreenMeta: async (screenId: Parameters<typeof getCustomerScreen>[0]) => getCustomerScreen(screenId),

  submitSupportContact: (payload: Parameters<typeof submitSupportContact>[0]) => submitSupportContact(payload),

  submitProductInquiry: (payload: Parameters<typeof submitProductInquiry>[0]) => submitProductInquiry(payload)
};
