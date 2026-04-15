/**
 * Canonical display formatting utilities.
 *
 * Import from this file instead of defining inline formatters in pages.
 * Every function is safe to call with null / undefined — it returns "—" rather
 * than throwing.
 */

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * Format a minor-unit (cents) amount as a locale currency string.
 * @example formatMoney(4999, "GHS") → "GH₵49.99"
 */
export const formatMoney = (
  amountCents: number | null | undefined,
  currency: string | null | undefined,
): string => {
  if (amountCents == null || !currency) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2 }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
};

/**
 * Format a min–max price range for product listings.
 * Returns a single value when min === max.
 */
export const formatPriceRange = (
  pricing: {
    currency: string;
    minAmountCents: number;
    maxAmountCents: number;
  } | null | undefined,
): string => {
  if (!pricing) return "—";
  if (pricing.minAmountCents === pricing.maxAmountCents) {
    return formatMoney(pricing.minAmountCents, pricing.currency);
  }
  return `${formatMoney(pricing.minAmountCents, pricing.currency)} – ${formatMoney(pricing.maxAmountCents, pricing.currency)}`;
};

// ---------------------------------------------------------------------------
// Date & time
// ---------------------------------------------------------------------------

/**
 * Medium date + short time in the browser's locale.
 * @example "Apr 15, 2026, 2:30 PM"
 */
export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

/**
 * Medium date only.
 * @example "Apr 15, 2026"
 */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

/**
 * Medium date + medium time, pinned to UTC.
 * Use for order/payment timestamps where the timezone must be explicit.
 * @example "Apr 15, 2026, 14:30:00"
 */
export const formatDateTimeUtc = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "UTC" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

/**
 * Compact month + day + time for dense table cells.
 * @example "Apr 15, 2:30 PM"
 */
export const formatDateCompact = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

/**
 * Human-readable relative time ("3 minutes ago", "yesterday").
 * Falls back to formatDateTime for distant dates.
 */
export const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const abs = Math.abs(diffMs);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    if (abs < 60_000) return rtf.format(-Math.round(diffMs / 1_000), "second");
    if (abs < 3_600_000) return rtf.format(-Math.round(diffMs / 60_000), "minute");
    if (abs < 86_400_000) return rtf.format(-Math.round(diffMs / 3_600_000), "hour");
    if (abs < 7 * 86_400_000) return rtf.format(-Math.round(diffMs / 86_400_000), "day");
    return formatDateTime(iso);
  } catch {
    return formatDateTime(iso);
  }
};

// ---------------------------------------------------------------------------
// Enums & labels
// ---------------------------------------------------------------------------

/**
 * Convert a SCREAMING_SNAKE_CASE enum value to a sentence-cased label.
 * @example humanize("PENDING_PAYMENT") → "Pending payment"
 */
export const humanize = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  const spaced = raw.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/**
 * Title-case variant: every word is capitalised.
 * @example humanizeTitle("PENDING_PAYMENT") → "Pending Payment"
 */
export const humanizeTitle = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  return raw
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Initials from a full name or email.
 * @example initials("Jane Doe") → "JD"
 */
export const initials = (name: string | null | undefined): string => {
  const base = (name ?? "").trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
};

/**
 * Truncate a long string with an ellipsis.
 */
export const truncate = (str: string | null | undefined, max = 40): string => {
  if (!str) return "—";
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
};
