export const formatMoney = (amountCents: number | null | undefined, currency: string | null | undefined) => {
  if (amountCents == null || !currency) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
};

export const formatVariantOptions = (attributes: unknown): string => {
  if (attributes == null || typeof attributes !== "object" || Array.isArray(attributes)) {
    return "Default";
  }
  const record = attributes as Record<string, unknown>;
  const entries = Object.entries(record).filter(
    ([, value]) => value != null && String(value).trim() !== ""
  );
  if (entries.length === 0) {
    return "Default";
  }
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
};

export const parseMoneyInputToCents = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  const n = Number.parseFloat(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.round(n * 100);
};

export const centsToInputString = (cents: number | null | undefined): string => {
  if (cents == null) {
    return "";
  }
  return (cents / 100).toFixed(2);
};

export const humanizeMovementType = (type: string): string =>
  type
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
