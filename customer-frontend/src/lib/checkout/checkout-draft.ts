const DRAFT_KEY = "customer-checkout-draft-v1";
const CHECKOUT_IDEMPOTENCY_KEY = "customer-checkout-idempotency-v1";
const RESULT_KEY = "customer-checkout-result-v1";

export type CheckoutAddressDraft = {
  fullName: string;
  email?: string;
  phone: string;
  country: string;
  region: string;
  city: string;
  line1: string;
  line2?: string;
  postalCode: string;
};

export type CheckoutPaymentDraft = {
  channel: "card" | "mobile_money";
  mobileMoney?: { phone: string; provider: string };
  card?: {
    holderName?: string;
    last4?: string;
  };
};

export type CheckoutDraft = {
  address: CheckoutAddressDraft;
  billingSameAsShipping?: boolean;
  billingAddress?: CheckoutAddressDraft;
  shippingMethodCode: string;
  payment: CheckoutPaymentDraft;
};

export type CheckoutResultSnapshot = {
  /** Present after Paystack success + order materialization (or legacy pre-deferred checkout). */
  orderId?: string;
  orderNumber?: string;
  /** Set when checkout completes before an order row exists (Pay-before-order). */
  checkoutPaymentIntentId?: string;
  paymentId?: string;
  createdAt?: string;
  /** Snapshot of shipping address lines at order placement (no PII beyond what user entered). */
  shipToLines?: string[];
  shippingMethodLabel?: string;
  /** Shown instead of a fabricated delivery date range. */
  fulfillmentNote?: string;
};

export const formatShipToLinesFromAddress = (address: CheckoutAddressDraft): string[] => {
  const line2 = address.line2?.trim();
  const mid = [address.line1, line2].filter(Boolean).join(", ");
  const cityLine = [address.city, address.region, address.postalCode].filter(Boolean).join(", ");
  return [address.fullName.trim(), mid, cityLine, address.country.trim()].filter((s) => s.length > 0);
};

export const labelForShippingMethodCode = (code: string) =>
  code.trim().toUpperCase() === "PAY_ON_DELIVERY"
    ? "Pay on delivery"
    : code.trim().toUpperCase() === "PREPAID"
      ? "No pay on delivery (Standard delivery)"
      : code.trim() || "Shipping";

export const readCheckoutDraft = (): CheckoutDraft | null => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutDraft;
    if (!parsed?.address || !parsed.payment) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeCheckoutDraft = (draft: CheckoutDraft) => {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
};

export const clearCheckoutDraft = () => {
  sessionStorage.removeItem(DRAFT_KEY);
};

export const getOrCreateCheckoutIdempotencyKey = () => {
  const existing = sessionStorage.getItem(CHECKOUT_IDEMPOTENCY_KEY);
  if (existing && existing.length >= 8) return existing;
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? `cko_${crypto.randomUUID()}` : `cko_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(CHECKOUT_IDEMPOTENCY_KEY, next);
  return next;
};

export const resetCheckoutIdempotencyKey = () => {
  sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_KEY);
};

export const writeCheckoutResult = (result: CheckoutResultSnapshot) => {
  sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
};

export const readCheckoutResult = (): CheckoutResultSnapshot | null => {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CheckoutResultSnapshot;
  } catch {
    return null;
  }
};

export const clearCheckoutResult = () => {
  sessionStorage.removeItem(RESULT_KEY);
};

/** After Paystack cancel/fail or abandoning a hosted session — next `complete` uses a new checkout idempotency key. */
export const resetCheckoutAttemptClientState = () => {
  clearCheckoutResult();
  resetCheckoutIdempotencyKey();
};
