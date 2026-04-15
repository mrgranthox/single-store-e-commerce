/** Map `GET /api/cart` evaluation payload to checkout UI summary shapes. */

const centsToGhs = (cents: number) => Math.round((cents / 100) * 100) / 100;

const formatAttrs = (attributes: unknown): string | undefined => {
  if (!attributes) return undefined;
  if (Array.isArray(attributes)) {
    const parts = attributes
      .map((row) => {
        if (!row || typeof row !== "object") return "";
        const r = row as { name?: string; value?: unknown };
        const v = String(r.value ?? "").trim();
        return v;
      })
      .filter(Boolean);
    return parts.length ? parts.join(" · ") : undefined;
  }
  return undefined;
};

export type CheckoutSummaryLine = {
  itemId: string;
  name: string;
  variant?: string;
  qty: number;
  price: number;
  image: string;
};

export const mapCartEvaluationToOrderSummary = (
  evaluation: unknown
): {
  lines: CheckoutSummaryLine[];
  subtotalGhs: number;
  taxGhs: number;
  shippingCents: number;
  totalGhs: number;
} => {
  if (!evaluation || typeof evaluation !== "object") {
    return { lines: [], subtotalGhs: 0, taxGhs: 0, shippingCents: 0, totalGhs: 0 };
  }
  const ev = evaluation as {
    items?: unknown[];
    normalizedTotals?: {
      subtotalCents?: number;
      taxCents?: number;
      shippingCents?: number;
      grandTotalCents?: number;
    };
  };
  const items = Array.isArray(ev.items) ? ev.items : [];
  const lines: CheckoutSummaryLine[] = items.map((row) => {
    const it = row as {
      id?: string;
      quantity?: number;
      product?: { title?: string };
      mediaUrl?: string | null;
      attributes?: unknown;
      pricing?: { lineSubtotalCents?: number };
    };
    const qty = typeof it.quantity === "number" ? it.quantity : 1;
    const lineCents = typeof it.pricing?.lineSubtotalCents === "number" ? it.pricing.lineSubtotalCents : 0;
    const image =
      typeof it.mediaUrl === "string" && it.mediaUrl.trim()
        ? it.mediaUrl.trim()
        : "https://placehold.co/160x200/e2e8f0/64748b/png?text=Item";
    return {
      itemId: typeof it.id === "string" ? it.id : `tmp_${Math.random().toString(36).slice(2)}`,
      name: typeof it.product?.title === "string" ? it.product.title : "Item",
      variant: formatAttrs(it.attributes),
      qty,
      price: centsToGhs(lineCents),
      image
    };
  });

  const nt = ev.normalizedTotals ?? {};
  const subtotalGhs = centsToGhs(typeof nt.subtotalCents === "number" ? nt.subtotalCents : 0);
  const taxGhs = centsToGhs(typeof nt.taxCents === "number" ? nt.taxCents : 0);
  const shippingCents = typeof nt.shippingCents === "number" ? nt.shippingCents : 0;
  const totalGhs = centsToGhs(typeof nt.grandTotalCents === "number" ? nt.grandTotalCents : 0);

  return { lines, subtotalGhs, taxGhs, shippingCents, totalGhs };
};
