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

export const customerApi = {
  getHomepage: async () => {
    const response = await fetch(new URL("/api/content/homepage", backendBaseUrl), {
      headers: { accept: "application/json" }
    });
    return readJson<{ entity: CustomerHomepagePayload }>(response);
  },
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
