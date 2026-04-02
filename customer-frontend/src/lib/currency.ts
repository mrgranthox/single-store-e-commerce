/** Ghana cedi — ISO 4217 */
export const STORE_CURRENCY_CODE = "GHS";

/** Unicode cedi sign (₵) */
export const CEDI_SYMBOL = "\u20B5";

/** Free standard shipping when cart subtotal >= this amount (GHS). */
export const FREE_SHIPPING_THRESHOLD_GHS = 250;

/**
 * Format a GHS amount with the cedi symbol (e.g. ₵1,234.56).
 * @param fractionDigits — 2 for prices, 0 for whole-cedi thresholds in copy
 */
export function formatGhs(amount: number, fractionDigits: 0 | 2 = 2): string {
  return `${CEDI_SYMBOL}${amount.toLocaleString("en-GH", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}
