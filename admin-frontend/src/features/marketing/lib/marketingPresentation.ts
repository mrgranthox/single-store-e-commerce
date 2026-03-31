import type { CouponListItem } from "@/features/marketing/api/admin-marketing.api";

export const formatAdminDate = (iso: string | null | undefined) => {
  if (!iso) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const formatAdminDateTime = (iso: string | null | undefined) => {
  if (!iso) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const humanizeLabel = (raw: string) =>
  raw
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const formatDiscountLine = (c: CouponListItem) => {
  const t = c.discountType?.toUpperCase() ?? "";
  if (t === "PERCENTAGE" && c.discountValue != null) {
    return `${c.discountValue}% off order`;
  }
  if (t === "FIXED_AMOUNT" && c.discountValue != null) {
    return `₵${(c.discountValue / 100).toFixed(2)} off`;
  }
  if (t === "FREE_SHIPPING") {
    return "Free shipping";
  }
  return humanizeLabel(c.discountType || "Discount");
};

export const formatCentsMoney = (cents: number | null | undefined) => {
  if (cents == null) {
    return "—";
  }
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(cents / 100);
};

/** Stitch-style uppercase discount cell (e.g. 20% OFF, $15.00 OFF). */
export const formatDiscountStitch = (c: CouponListItem) => {
  const t = c.discountType?.toUpperCase() ?? "";
  if (t === "PERCENTAGE" && c.discountValue != null) {
    return `${c.discountValue}% OFF`;
  }
  if (t === "FIXED_AMOUNT" && c.discountValue != null) {
    return `${new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(c.discountValue / 100)} OFF`;
  }
  if (t === "FREE_SHIPPING") {
    return "FREE SHIPPING";
  }
  return humanizeLabel(c.discountType || "Discount").toUpperCase();
};

export const statusCount = (rows: { status: string; count: number }[], status: string) =>
  rows.find((r) => r.status === status)?.count ?? 0;

export const sumStatusCounts = (rows: { status: string; count: number }[]) =>
  rows.reduce((acc, r) => acc + r.count, 0);

const formatTargetingLeaf = (v: unknown): string => {
  if (v === null || v === undefined) {
    return "—";
  }
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || ["string", "number", "boolean"].includes(typeof x))) {
      return v.map(String).join(", ");
    }
    return `${v.length} items`;
  }
  return "See advanced details";
};

export const formatRuleTargetingRows = (targeting: unknown): { label: string; value: string }[] => {
  if (targeting == null) {
    return [];
  }
  if (Array.isArray(targeting)) {
    return [{ label: "Entries", value: formatTargetingLeaf(targeting) }];
  }
  if (typeof targeting !== "object") {
    return [{ label: "Value", value: String(targeting) }];
  }
  const out: { label: string; value: string }[] = [];
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const label = prefix ? `${prefix} · ${humanizeLabel(k)}` : humanizeLabel(k);
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        walk(v as Record<string, unknown>, label);
      } else {
        out.push({ label, value: formatTargetingLeaf(v) });
      }
    }
  };
  walk(targeting as Record<string, unknown>, "");
  return out;
};

export const promotionRuleIcon = (ruleType: string) => {
  const u = ruleType.toUpperCase();
  if (u.includes("SEGMENT") || u.includes("CUSTOMER")) {
    return "person_search";
  }
  if (u.includes("CART") || u.includes("ORDER")) {
    return "shopping_cart";
  }
  if (u.includes("PRODUCT")) {
    return "inventory_2";
  }
  return "rule_settings";
};
