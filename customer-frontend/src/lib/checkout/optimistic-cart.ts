type OptimisticCartItem = {
  id?: string;
  variantId?: string;
  quantity?: number;
  product?: {
    id?: string;
    slug?: string;
    title?: string;
    status?: string;
  };
  mediaUrl?: string | null;
  attributes?: unknown;
  pricing?: {
    current?: {
      amountCents?: number;
      currency?: string;
      compareAtAmountCents?: number;
    };
    snapshot?: {
      amountCents?: number;
      currency?: string;
    };
    lineSubtotalCents?: number;
  };
};

type OptimisticCartEvaluation = {
  items?: OptimisticCartItem[];
  couponOutcome?: {
    valid?: boolean;
    discountCents?: number;
  } | null;
  normalizedTotals?: {
    subtotalCents?: number;
    discountCents?: number;
    shippingCents?: number;
    taxCents?: number;
    grandTotalCents?: number;
    currency?: string;
  };
};

type OptimisticAddInput = {
  variantId: string;
  quantity?: number;
  unitAmountCents?: number;
  mediaUrl?: string | null;
  product?: {
    id?: string;
    slug?: string;
    title?: string;
    status?: string;
  };
};

const toInt = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

const resolveUnitAmountCents = (item: OptimisticCartItem | undefined, provided?: number) => {
  if (typeof provided === "number" && Number.isFinite(provided) && provided > 0) {
    return Math.round(provided);
  }
  const fromCurrent = item?.pricing?.current?.amountCents;
  if (typeof fromCurrent === "number" && Number.isFinite(fromCurrent) && fromCurrent > 0) {
    return Math.round(fromCurrent);
  }
  const fromSnapshot = item?.pricing?.snapshot?.amountCents;
  if (typeof fromSnapshot === "number" && Number.isFinite(fromSnapshot) && fromSnapshot > 0) {
    return Math.round(fromSnapshot);
  }
  const qty = toInt(item?.quantity);
  const lineSubtotal = toInt(item?.pricing?.lineSubtotalCents);
  if (qty > 0 && lineSubtotal > 0) {
    return Math.round(lineSubtotal / qty);
  }
  return 0;
};

export const applyOptimisticAddCartItem = (evaluation: unknown, input: OptimisticAddInput): unknown => {
  if (!evaluation || typeof evaluation !== "object") return evaluation;
  const source = evaluation as OptimisticCartEvaluation;
  const items = Array.isArray(source.items) ? source.items : [];
  const addQty = Math.max(1, Math.trunc(input.quantity ?? 1));
  const existing = items.find((item) => item?.variantId === input.variantId);
  const unitAmountCents = resolveUnitAmountCents(existing, input.unitAmountCents);
  if (unitAmountCents <= 0) return evaluation;

  const nextItems: OptimisticCartItem[] = existing
    ? items.map((item) => {
        if (!item || item.variantId !== input.variantId) return item;
        const currentQty = toInt(item.quantity);
        const nextQty = currentQty + addQty;
        return {
          ...item,
          quantity: nextQty,
          pricing: {
            ...(item.pricing ?? {}),
            lineSubtotalCents: unitAmountCents * nextQty
          }
        };
      })
    : [
        ...items,
        {
          id: `optimistic_${input.variantId}`,
          variantId: input.variantId,
          quantity: addQty,
          mediaUrl: input.mediaUrl ?? null,
          attributes: null,
          product: {
            id: input.product?.id,
            slug: input.product?.slug,
            title: input.product?.title ?? "Item",
            status: input.product?.status ?? "PUBLISHED"
          },
          pricing: {
            current: { amountCents: unitAmountCents, currency: "GHS" },
            snapshot: { amountCents: unitAmountCents, currency: "GHS" },
            lineSubtotalCents: unitAmountCents * addQty
          }
        }
      ];

  const totals = source.normalizedTotals ?? {};
  const prevSubtotal = toInt(totals.subtotalCents);
  const prevDiscount = toInt(totals.discountCents);
  const prevShipping = toInt(totals.shippingCents);
  const prevTax = toInt(totals.taxCents);
  const subtotalDelta = unitAmountCents * addQty;
  const nextSubtotal = Math.max(0, prevSubtotal + subtotalDelta);
  const discountRate = prevSubtotal > 0 ? prevDiscount / prevSubtotal : 0;
  const nextDiscount = Math.max(0, Math.round(nextSubtotal * discountRate));
  const nextGrandTotal = Math.max(0, nextSubtotal - nextDiscount + prevShipping + prevTax);

  return {
    ...source,
    items: nextItems,
    couponOutcome:
      source.couponOutcome && typeof source.couponOutcome === "object"
        ? {
            ...source.couponOutcome,
            discountCents: source.couponOutcome.valid ? nextDiscount : source.couponOutcome.discountCents
          }
        : source.couponOutcome,
    normalizedTotals: {
      ...totals,
      subtotalCents: nextSubtotal,
      discountCents: nextDiscount,
      grandTotalCents: nextGrandTotal
    }
  } satisfies OptimisticCartEvaluation;
};
