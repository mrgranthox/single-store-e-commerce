/** Product: single gateway — Paystack (GH). */
export const PAYSTACK_GATEWAY_NAME = "Paystack";

export const PAYSTACK_RAILS_SUMMARY =
  "Mobile money (MTN, Telecel, AirtelTigo) and cards (Visa, Mastercard).";

export const PAYSTACK_RAILS_COMPACT = "MTN · Telecel · AirtelTigo · Visa · Mastercard";

export const PAYSTACK_GATEWAY_HELP =
  "All payments settle through Paystack — " + PAYSTACK_RAILS_SUMMARY.toLowerCase();

export const PAYSTACK_PROVIDER_QUERY_VALUE = "paystack";

export const formatPaymentGatewayLabel = (apiProvider: string | null | undefined): string => {
  const p = (apiProvider ?? "").trim().toLowerCase();
  if (!p || p === PAYSTACK_PROVIDER_QUERY_VALUE) return PAYSTACK_GATEWAY_NAME;
  return (apiProvider ?? "").trim() || "—";
};

const readRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Paystack webhooks/API often nest under `data`. */
const paystackDataRoot = (payload: unknown): Record<string, unknown> | null => {
  const root = readRecord(payload);
  if (!root) return null;
  const data = readRecord(root.data);
  return data ?? root;
};

const normalizeMm = (raw: string): string => {
  const s = raw.toLowerCase().replace(/\s+/g, "");
  if (s.includes("mtn")) return "MTN Mobile Money";
  if (s.includes("telecel")) return "Telecel Cash";
  if (s.includes("airtel") || s.includes("tigo") || s.includes("airteltigo")) return "AirtelTigo Money";
  return raw;
};

/**
 * Best-effort shopper-facing rail label from a stored transaction payload (Paystack-shaped).
 */
export const inferPaystackRailLabel = (payload: unknown): string | null => {
  const d = paystackDataRoot(payload);
  if (!d) return null;

  const channel = typeof d.channel === "string" ? d.channel.toLowerCase() : null;

  if (channel === "card") {
    const auth = readRecord(d.authorization);
    const brand = typeof auth?.brand === "string" ? auth.brand.toUpperCase() : "";
    if (brand.includes("VISA")) return "Card · Visa";
    if (brand.includes("MASTERCARD") || brand.includes("MASTER")) return "Card · Mastercard";
    return "Card";
  }

  if (channel === "mobile_money" || channel === "mobilemoney" || channel === "ussd") {
    const mmRec = readRecord(d.mobile_money);
    const mm =
      (typeof d.provider === "string" && d.provider) ||
      (typeof d.mobile_money_provider === "string" && d.mobile_money_provider) ||
      (typeof d.mobileMoneyProvider === "string" && d.mobileMoneyProvider) ||
      (mmRec && typeof mmRec.provider === "string" ? mmRec.provider : "");
    if (mm) return normalizeMm(mm);
    return "Mobile money";
  }

  return null;
};

/** Prefer the most recent transaction that yields a rail label. */
export const inferPaymentRailFromTransactions = (
  transactions: Array<{ payload: unknown; createdAt?: string }>
): string | null => {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );
  for (const tx of sorted) {
    const label = inferPaystackRailLabel(tx.payload);
    if (label) return label;
  }
  return null;
};
