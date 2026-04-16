import { commerceFetchJson } from "@/lib/api/commerce-fetch";

const qs = (params: Record<string, string | number | undefined>) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === "") return;
    u.set(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : "";
};

/** Cart + checkout evaluation payload from `GET /api/cart`. */
export type CartEvaluation = unknown;

export const customerBackendApi = {
  // --- Storefront (public; session header still sent) ---
  listProducts: async (
    params?: {
      query?: string;
      q?: string;
      page?: number;
      page_size?: number;
      sort?: "newest" | "oldest" | "title_asc" | "title_desc";
      sortBy?: "updatedAt" | "createdAt" | "title";
      sortOrder?: "asc" | "desc";
    }
  ) => {
    const q = qs({
      query: params?.query,
      q: params?.q,
      page: params?.page,
      page_size: params?.page_size,
      sort: params?.sort,
      sortBy: params?.sortBy,
      sortOrder: params?.sortOrder
    });
    return commerceFetchJson<{ items: unknown[] }>(`/api/products${q}`, { method: "GET" });
  },

  getProduct: async (slug: string) => commerceFetchJson<unknown>(`/api/products/${encodeURIComponent(slug)}`, { method: "GET" }),

  listProductReviews: async (slug: string, page = 1, page_size = 20) =>
    commerceFetchJson<{ items: unknown[] }>(
      `/api/products/${encodeURIComponent(slug)}/reviews${qs({ page, page_size })}`,
      { method: "GET" }
    ),

  getProductQuestions: async (slug: string) =>
    commerceFetchJson<unknown>(`/api/products/${encodeURIComponent(slug)}/questions`, { method: "GET" }),

  createProductInquiry: async (
    slug: string,
    body: { message: string; name?: string; email?: string; captchaToken?: string | null }
  ) =>
    commerceFetchJson<unknown>(`/api/products/${encodeURIComponent(slug)}/inquiry`, {
      method: "POST",
      json: body,
      auth: false
    }),

  listCategories: async () => commerceFetchJson<{ items: unknown[] }>("/api/categories", { method: "GET" }),

  listCategoryProducts: async (slug: string, params?: { page?: number; page_size?: number }) =>
    commerceFetchJson<{ category: unknown; items: unknown[] }>(
      `/api/categories/${encodeURIComponent(slug)}/products${qs({ page: params?.page, page_size: params?.page_size })}`,
      { method: "GET" }
    ),

  listBrandProducts: async (slug: string, params?: { page?: number; page_size?: number }) =>
    commerceFetchJson<{ brand: unknown; items: unknown[] }>(
      `/api/brands/${encodeURIComponent(slug)}/products${qs({ page: params?.page, page_size: params?.page_size })}`,
      { method: "GET" }
    ),

  searchProducts: async (params?: { q?: string; page?: number; page_size?: number }) =>
    commerceFetchJson<{ items: unknown[]; query: string | null }>(`/api/search${qs({ q: params?.q, page: params?.page, page_size: params?.page_size })}`, {
      method: "GET"
    }),

  getCampaign: async (slug: string) =>
    commerceFetchJson<unknown>(`/api/catalog/campaigns/${encodeURIComponent(slug)}`, { method: "GET" }),

  listBanners: async (placement?: string) =>
    commerceFetchJson<unknown>(`/api/banners${qs({ placement })}`, { method: "GET" }),

  getPage: async (slug: string) => commerceFetchJson<unknown>(`/api/pages/${encodeURIComponent(slug)}`, { method: "GET" }),

  getHelpPage: async () => commerceFetchJson<unknown>("/api/help", { method: "GET" }),

  getContactPage: async () => commerceFetchJson<unknown>("/api/contact", { method: "GET" }),

  getSupportPublicConfig: async () =>
    commerceFetchJson<unknown>("/api/support/public-config", { method: "GET", auth: false }),

  postPublicSupportContact: async (body: unknown) =>
    commerceFetchJson<unknown>("/api/support/contact", { method: "POST", json: body, auth: false }),

  // --- Cart & checkout ---
  getCart: async () => commerceFetchJson<CartEvaluation>("/api/cart", { method: "GET" }),

  addCartItem: async (body: { variantId: string; quantity: number }) =>
    commerceFetchJson<CartEvaluation>("/api/cart/items", { method: "POST", json: body }),

  patchCartItem: async (itemId: string, body: { quantity: number }) =>
    commerceFetchJson<CartEvaluation>(`/api/cart/items/${encodeURIComponent(itemId)}`, { method: "PATCH", json: body }),

  deleteCartItem: async (itemId: string) =>
    commerceFetchJson<CartEvaluation>(`/api/cart/items/${encodeURIComponent(itemId)}`, { method: "DELETE" }),

  applyCartCoupon: async (code: string) =>
    commerceFetchJson<CartEvaluation>("/api/cart/coupon", { method: "POST", json: { code } }),

  removeCartCoupon: async () => commerceFetchJson<CartEvaluation>("/api/cart/coupon", { method: "DELETE" }),

  validateCheckout: async (body: unknown) =>
    commerceFetchJson<unknown>("/api/checkout/validate", { method: "POST", json: body }),

  createOrder: async (body: unknown) =>
    commerceFetchJson<{ entity: unknown }>("/api/checkout/create-order", { method: "POST", json: body }),

  /** Single request: initialize Paystack; order is created after PSP success (deferred materialization). */
  completeCheckout: async (body: unknown) =>
    commerceFetchJson<{
      order: unknown | null;
      checkoutPaymentIntentId: string;
      payment: unknown;
    }>("/api/checkout/complete", { method: "POST", json: body }),

  initializePayment: async (body: unknown) =>
    commerceFetchJson<{ entity: unknown }>("/api/checkout/initialize-payment", { method: "POST", json: body }),

  getCheckoutPaymentReturn: async (params: {
    paymentId: string;
    orderId?: string;
    checkoutPaymentIntentId?: string;
  }) =>
    commerceFetchJson<{
      orderId: string | null;
      orderNumber: string | null;
      orderStatus: string | null;
      checkoutPaymentIntentId: string | null;
      paymentId: string;
      paymentState: string;
      pendingMaterialization?: boolean;
    }>(
      `/api/checkout/payment-return${qs({
        paymentId: params.paymentId,
        ...(params.orderId ? { orderId: params.orderId } : {}),
        ...(params.checkoutPaymentIntentId ? { checkoutPaymentIntentId: params.checkoutPaymentIntentId } : {})
      })}`,
      {
        method: "GET"
      }
    ),

  trackGuestOrder: async (body: { orderNumber: string; email: string }) =>
    commerceFetchJson<{ entity: unknown }>("/api/orders/track", { method: "POST", json: body, auth: false }),

  // --- Account (authenticated) ---
  getAccountOverview: async () => commerceFetchJson<unknown>("/api/account", { method: "GET" }),

  getProfile: async () => commerceFetchJson<unknown>("/api/account/profile", { method: "GET" }),

  patchProfile: async (body: unknown) =>
    commerceFetchJson<unknown>("/api/account/profile", { method: "PATCH", json: body }),

  getPreferences: async () => commerceFetchJson<unknown>("/api/account/preferences", { method: "GET" }),

  patchPreferences: async (body: unknown) =>
    commerceFetchJson<unknown>("/api/account/preferences", { method: "PATCH", json: body }),

  listAddresses: async () => commerceFetchJson<unknown>("/api/account/addresses", { method: "GET" }),

  createAddress: async (body: unknown) =>
    commerceFetchJson<unknown>("/api/account/addresses", { method: "POST", json: body }),

  patchAddress: async (addressId: string, body: unknown) =>
    commerceFetchJson<unknown>(`/api/account/addresses/${encodeURIComponent(addressId)}`, { method: "PATCH", json: body }),

  deleteAddress: async (addressId: string) =>
    commerceFetchJson<unknown>(`/api/account/addresses/${encodeURIComponent(addressId)}`, { method: "DELETE" }),

  setDefaultAddress: async (addressId: string, body: unknown) =>
    commerceFetchJson<unknown>(`/api/account/addresses/${encodeURIComponent(addressId)}/default`, {
      method: "POST",
      json: body
    }),

  getSecurity: async () => commerceFetchJson<unknown>("/api/account/security", { method: "GET" }),

  listSecuritySessions: async () => commerceFetchJson<unknown>("/api/account/security/sessions", { method: "GET" }),

  deleteSecuritySession: async (sessionId: string) =>
    commerceFetchJson<unknown>(`/api/account/security/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),

  changePassword: async (body: unknown) =>
    commerceFetchJson<unknown>("/api/account/security/change-password", { method: "POST", json: body }),

  listOrders: async (params?: { page?: number; page_size?: number; status?: string }) =>
    commerceFetchJson<{ items: unknown[] }>(`/api/account/orders${qs({ page: params?.page, page_size: params?.page_size, status: params?.status })}`, {
      method: "GET"
    }),

  getOrder: async (orderId: string) => commerceFetchJson<unknown>(`/api/account/orders/${encodeURIComponent(orderId)}`, { method: "GET" }),

  getOrderTracking: async (orderId: string) =>
    commerceFetchJson<unknown>(`/api/account/orders/${encodeURIComponent(orderId)}/tracking`, { method: "GET" }),

  cancelOrder: async (orderId: string, body: { reason: string; note?: string }) =>
    commerceFetchJson<unknown>(`/api/account/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST", json: body }),

  listReturns: async (params?: { page?: number; page_size?: number }) =>
    commerceFetchJson<unknown>(`/api/account/returns${qs({ page: params?.page, page_size: params?.page_size })}`, { method: "GET" }),

  listRefunds: async (params?: { page?: number; page_size?: number }) =>
    commerceFetchJson<unknown>(`/api/account/refunds${qs({ page: params?.page, page_size: params?.page_size })}`, { method: "GET" }),

  getReturnEligibility: async (orderId: string) =>
    commerceFetchJson<unknown>(`/api/account/orders/${encodeURIComponent(orderId)}/return-eligibility`, { method: "GET" }),

  createReturn: async (orderId: string, body: unknown) =>
    commerceFetchJson<unknown>(`/api/account/orders/${encodeURIComponent(orderId)}/returns`, { method: "POST", json: body }),

  listAccountReviews: async (params?: { page?: number; page_size?: number }) =>
    commerceFetchJson<unknown>(`/api/account/reviews${qs({ page: params?.page, page_size: params?.page_size })}`, { method: "GET" }),

  createReview: async (body: unknown) => commerceFetchJson<unknown>("/api/account/reviews", { method: "POST", json: body }),

  patchReview: async (reviewId: string, body: unknown) =>
    commerceFetchJson<unknown>(`/api/account/reviews/${encodeURIComponent(reviewId)}`, { method: "PATCH", json: body }),

  getOrderReviewEligibility: async (orderId: string) =>
    commerceFetchJson<unknown>(`/api/account/orders/${encodeURIComponent(orderId)}/review-eligibility`, { method: "GET" }),

  // --- Wishlist ---
  listWishlist: async (params?: { page?: number; page_size?: number }) =>
    commerceFetchJson<unknown>(`/api/account/wishlist${qs({ page: params?.page, page_size: params?.page_size })}`, { method: "GET" }),

  addWishlistItem: async (body: { productId?: string; variantId?: string }) =>
    commerceFetchJson<unknown>("/api/account/wishlist/items", { method: "POST", json: body }),

  deleteWishlistItem: async (itemId: string) =>
    commerceFetchJson<unknown>(`/api/account/wishlist/items/${encodeURIComponent(itemId)}`, { method: "DELETE" }),

  // --- Support (account contract) ---
  listSupportTickets: async (params?: { page?: number; page_size?: number }) =>
    commerceFetchJson<unknown>(`/api/account/support/tickets${qs({ page: params?.page, page_size: params?.page_size })}`, {
      method: "GET"
    }),

  createSupportTicket: async (body: unknown) =>
    commerceFetchJson<unknown>("/api/account/support/tickets", { method: "POST", json: body }),

  getSupportTicket: async (ticketId: string) =>
    commerceFetchJson<unknown>(`/api/account/support/tickets/${encodeURIComponent(ticketId)}`, { method: "GET" }),

  postSupportTicketMessage: async (ticketId: string, body: unknown) =>
    commerceFetchJson<unknown>(`/api/account/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
      method: "POST",
      json: body
    }),

  listSupportIssueOptions: async () =>
    commerceFetchJson<unknown>("/api/mobile/support/issues", { method: "GET" })
};
