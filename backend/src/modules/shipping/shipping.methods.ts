const DEFAULT_CURRENCY = "GHS";
const GHANA_PREPAID_FREE_THRESHOLD_CENTS = 25_000;
const GHANA_PREPAID_ABOVE_THRESHOLD_FEE_CENTS = 2_000;
const GHANA_PREPAID_BELOW_THRESHOLD_FEE_CENTS = 3_000;

export const buildShippingMethodOptions = (
  currency: string | null = null,
  subtotalCents = 0
) => {
  const safeSubtotal = Number.isFinite(subtotalCents) ? Math.max(0, Math.trunc(subtotalCents)) : 0;
  const prepaidShippingFeeCents =
    safeSubtotal > GHANA_PREPAID_FREE_THRESHOLD_CENTS
      ? GHANA_PREPAID_ABOVE_THRESHOLD_FEE_CENTS
      : GHANA_PREPAID_BELOW_THRESHOLD_FEE_CENTS;

  return [
    {
      code: "PAY_ON_DELIVERY",
      label: "Pay on delivery",
      amountCents: 0,
      currency: currency ?? DEFAULT_CURRENCY,
      estimatedDeliveryWindow: "1-3 business days",
      available: true
    },
    {
      code: "PREPAID",
      label: "No pay on delivery (Standard delivery)",
      amountCents: prepaidShippingFeeCents,
      currency: currency ?? DEFAULT_CURRENCY,
      estimatedDeliveryWindow: "1-3 business days",
      available: true
    }
  ];
};
