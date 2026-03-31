export const formatMoney = (amountCents: number | null | undefined, currency: string | null | undefined) => {
  if (amountCents == null || !currency) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
};

export const formatProductListPrice = (
  pricing: {
    currency: string;
    minAmountCents: number;
    maxAmountCents: number;
  } | null
) => {
  if (!pricing) {
    return "—";
  }
  if (pricing.minAmountCents === pricing.maxAmountCents) {
    return formatMoney(pricing.minAmountCents, pricing.currency);
  }
  return `${formatMoney(pricing.minAmountCents, pricing.currency)} – ${formatMoney(pricing.maxAmountCents, pricing.currency)}`;
};
