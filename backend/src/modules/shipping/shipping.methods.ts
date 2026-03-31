const DEFAULT_CURRENCY = "GHS";

export const buildShippingMethodOptions = (currency: string | null = null) => [
  {
    code: "STANDARD",
    label: "Standard shipping",
    amountCents: 0,
    currency: currency ?? DEFAULT_CURRENCY,
    estimatedDeliveryWindow: "3-5 business days",
    available: true
  }
];
