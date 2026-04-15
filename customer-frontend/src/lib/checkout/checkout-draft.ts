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
};

export type CheckoutDraft = {
  address: CheckoutAddressDraft;
  shippingMethodCode: string;
  payment: CheckoutPaymentDraft;
};

export type CheckoutResultSnapshot = {
  orderId: string;
  orderNumber: string;
  createdAt?: string;
};

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
