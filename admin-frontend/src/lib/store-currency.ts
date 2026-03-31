/** Single-store currency for admin display and formatting (Ghana Cedis). */
export const STORE_CURRENCY_CODE = "GHS" as const;

export const formatMinorGhs = (cents: number) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: STORE_CURRENCY_CODE }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${STORE_CURRENCY_CODE}`;
  }
};
