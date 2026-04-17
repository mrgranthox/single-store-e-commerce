import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckoutHeader, CheckoutStepBar, CheckoutFooter, StoreBrandLink, StorefrontMain, StorefrontShell } from "@/components/layout";
import { STORE_NAME_FULL } from "@/lib/brand";
import { formatGhs, FREE_SHIPPING_THRESHOLD_GHS } from "@/lib/currency";
import { neutralFieldClass } from "@/lib/form-field-styles";
import { CheckoutOrderSummary } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { customerBackendApi } from "@/lib/api/customer-backend-api";
import { CommerceApiError } from "@/lib/api/commerce-fetch";
import {
  clearCheckoutDraft,
  formatShipToLinesFromAddress,
  getOrCreateCheckoutIdempotencyKey,
  labelForShippingMethodCode,
  readCheckoutDraft,
  readCheckoutResult,
  resetCheckoutAttemptClientState,
  resetCheckoutIdempotencyKey,
  writeCheckoutDraft,
  writeCheckoutResult
} from "@/lib/checkout/checkout-draft";
import { mapCartEvaluationToOrderSummary } from "@/lib/checkout/map-cart-evaluation";
import { CUSTOMER_CART_QUERY_ROOT, useCustomerCartQueryKey } from "@/hooks/use-cart-summary";
import { useCustomerStore } from "@/lib/store/customer-store";

type CartEvalItem = {
  id?: string;
  quantity?: number;
  pricing?: {
    lineSubtotalCents?: number;
  };
};

type CartEvalShape = {
  items?: CartEvalItem[];
  shippingOptions?: Array<{
    code?: string;
    label?: string;
    amountCents?: number;
    currency?: string;
    estimatedDeliveryWindow?: string;
    available?: boolean;
  }>;
  normalizedTotals?: {
    subtotalCents?: number;
    discountCents?: number;
    shippingCents?: number;
    taxCents?: number;
    grandTotalCents?: number;
  };
};

type AccountAddressRow = {
  id: string;
  label: string | null;
  fullName: string;
  country: string;
  region: string;
  city: string;
  postalCode: string | null;
  addressLine1: string;
  addressLine2: string | null;
  isDefaultShipping: boolean;
};

type CheckoutShippingOptionView = {
  code: "PAY_ON_DELIVERY" | "PREPAID";
  label: string;
  amountCents: number;
  estimatedDeliveryWindow: string;
};

const toNonNegativeInt = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);

const buildEffectiveShippingOptions = (evaluation: unknown, subtotalGhs: number): CheckoutShippingOptionView[] => {
  const data = evaluation && typeof evaluation === "object" ? (evaluation as CartEvalShape) : null;
  const rawOptions = Array.isArray(data?.shippingOptions) ? data.shippingOptions : [];
  const normalized = rawOptions
    .map((option) => {
      const code = typeof option?.code === "string" ? option.code.trim().toUpperCase() : "";
      if (code === "PAY_ON_DELIVERY") {
        return {
          code: "PAY_ON_DELIVERY" as const,
          label: "Pay on delivery",
          amountCents: 0,
          estimatedDeliveryWindow:
            typeof option?.estimatedDeliveryWindow === "string" && option.estimatedDeliveryWindow.trim()
              ? option.estimatedDeliveryWindow.trim()
              : "1-3 business days"
        };
      }
      if (code === "PREPAID") {
        return {
          code: "PREPAID" as const,
          label: "No pay on delivery (Standard delivery)",
          amountCents: toNonNegativeInt(option?.amountCents),
          estimatedDeliveryWindow:
            typeof option?.estimatedDeliveryWindow === "string" && option.estimatedDeliveryWindow.trim()
              ? option.estimatedDeliveryWindow.trim()
              : "1-3 business days"
        };
      }
      return null;
    })
    .filter((option): option is CheckoutShippingOptionView => Boolean(option));

  if (normalized.length === 2) {
    return normalized;
  }

  const subtotalCents = Math.max(0, Math.round(subtotalGhs * 100));
  const prepaidFeeCents = subtotalCents > 25_000 ? 2_000 : 3_000;
  return [
    {
      code: "PAY_ON_DELIVERY",
      label: "Pay on delivery",
      amountCents: 0,
      estimatedDeliveryWindow: "1-3 business days"
    },
    {
      code: "PREPAID",
      label: "No pay on delivery (Standard delivery)",
      amountCents: prepaidFeeCents,
      estimatedDeliveryWindow: "1-3 business days"
    }
  ];
};

const applyOptimisticCartQuantity = (evaluation: unknown, itemId: string, nextQuantity: number): unknown => {
  if (!evaluation || typeof evaluation !== "object") return evaluation;
  const source = evaluation as CartEvalShape;
  const sourceItems = Array.isArray(source.items) ? source.items : [];
  const clampedQty = Math.max(0, Math.trunc(nextQuantity));
  const target = sourceItems.find((item) => item && item.id === itemId);
  if (!target) return evaluation;

  const currentQty = toNonNegativeInt(target.quantity);
  const currentLineSubtotal = toNonNegativeInt(target.pricing?.lineSubtotalCents);
  const unitPriceCents = currentQty > 0 ? Math.round(currentLineSubtotal / currentQty) : 0;
  const nextLineSubtotal = clampedQty > 0 ? unitPriceCents * clampedQty : 0;

  const nextItems =
    clampedQty > 0
      ? sourceItems.map((item) =>
          item && item.id === itemId
            ? {
                ...item,
                quantity: clampedQty,
                pricing: {
                  ...(item.pricing ?? {}),
                  lineSubtotalCents: nextLineSubtotal
                }
              }
            : item
        )
      : sourceItems.filter((item) => !(item && item.id === itemId));

  const totals = source.normalizedTotals ?? {};
  const currentSubtotal = toNonNegativeInt(totals.subtotalCents);
  const currentDiscount = toNonNegativeInt(totals.discountCents);
  const currentShipping = toNonNegativeInt(totals.shippingCents);
  const currentTax = toNonNegativeInt(totals.taxCents);
  const subtotalDelta = nextLineSubtotal - currentLineSubtotal;
  const optimisticSubtotal = Math.max(0, currentSubtotal + subtotalDelta);
  const discountRate = currentSubtotal > 0 ? currentDiscount / currentSubtotal : 0;
  const optimisticDiscount = Math.max(0, Math.round(optimisticSubtotal * discountRate));
  const optimisticGrandTotal = Math.max(0, optimisticSubtotal - optimisticDiscount + currentShipping + currentTax);

  return {
    ...source,
    items: nextItems,
    normalizedTotals: {
      ...totals,
      subtotalCents: optimisticSubtotal,
      discountCents: optimisticDiscount,
      grandTotalCents: optimisticGrandTotal
    }
  } satisfies CartEvalShape;
};

/* ─────────────────────────────────────────────
   CART PAGE — matches cart_review/code.html
───────────────────────────────────────────── */
export const CartPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cartQueryKey = useCustomerCartQueryKey();
  const [coupon, setCoupon] = useState("");
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const pendingItemIdsRef = useRef<Set<string>>(new Set());
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());

  const cartQuery = useQuery({
    queryKey: cartQueryKey,
    queryFn: async () => {
      const { data } = await customerBackendApi.getCart();
      return data;
    },
    staleTime: 30_000
  });

  const summary = mapCartEvaluationToOrderSummary(cartQuery.data);
  const lines = summary.lines.map((l) => ({
    name: l.name,
    variant: l.variant,
    qty: l.qty,
    price: l.price,
    image: l.image
  }));
  const couponOutcome = summary.couponOutcome;
  const couponLocked = Boolean(couponOutcome?.valid);
  const couponDiscountGhs =
    couponOutcome?.valid && typeof couponOutcome.discountCents === "number" ? couponOutcome.discountCents / 100 : 0;
  const hiddenDeltaGhs = Math.round((summary.totalGhs - (summary.subtotalGhs - couponDiscountGhs)) * 100) / 100;
  const showHiddenDeltaHint = Math.abs(hiddenDeltaGhs) >= 0.01;

  const setItemPendingState = (itemId: string, pending: boolean) => {
    if (pending) {
      pendingItemIdsRef.current.add(itemId);
    } else {
      pendingItemIdsRef.current.delete(itemId);
    }
    setPendingItemIds(new Set(pendingItemIdsRef.current));
  };

  const patchQty = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      if (quantity < 1) {
        return customerBackendApi.deleteCartItem(itemId);
      }
      return customerBackendApi.patchCartItem(itemId, { quantity });
    },
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previousCart = queryClient.getQueryData(cartQueryKey);
      const optimistic = applyOptimisticCartQuantity(previousCart, itemId, quantity);
      queryClient.setQueryData(cartQueryKey, optimistic);
      return { previousCart };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCart !== undefined) {
        queryClient.setQueryData(cartQueryKey, context.previousCart);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(cartQueryKey, data.data);
    }
  });

  const mutateCartLineQuantity = async (itemId: string, quantity: number) => {
    if (pendingItemIdsRef.current.has(itemId)) return;
    setItemPendingState(itemId, true);
    try {
      await patchQty.mutateAsync({ itemId, quantity });
    } finally {
      setItemPendingState(itemId, false);
    }
  };

  const applyCouponMut = useMutation({
    mutationFn: async (code: string) => customerBackendApi.applyCartCoupon(code.trim()),
    onSuccess: (data) => {
      setCouponErr(null);
      setCoupon((existing) => existing.trim());
      queryClient.setQueryData(cartQueryKey, data.data);
    },
    onError: (e) => {
      setCouponErr(e instanceof CommerceApiError ? e.message : "Invalid coupon.");
    }
  });

  const removeCouponMut = useMutation({
    mutationFn: async () => customerBackendApi.removeCartCoupon(),
    onSuccess: (data) => {
      setCouponErr(null);
      setCoupon("");
      queryClient.setQueryData(cartQueryKey, data.data);
    },
    onError: (e) => {
      setCouponErr(e instanceof CommerceApiError ? e.message : "Could not remove coupon.");
    }
  });

  if (cartQuery.isPending) {
    return (
      <StorefrontShell>
        <StorefrontMain className="text-on-surface py-24 text-center text-on-surface-variant">Loading your bag…</StorefrontMain>
      </StorefrontShell>
    );
  }

  if (cartQuery.isError) {
    return (
      <StorefrontShell>
        <StorefrontMain className="text-on-surface py-24 text-center text-error text-sm">
          Could not load your cart.
        </StorefrontMain>
      </StorefrontShell>
    );
  }

  if (lines.length === 0) {
    return (
      <StorefrontShell>
        <StorefrontMain className="text-on-surface">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-sm font-label font-bold uppercase tracking-widest text-secondary hover:underline underline-offset-4 mb-8"
          >
            <Icon name="arrow_back" className="text-lg" />
            Back to shop
          </Link>
          <div className="flex flex-col items-center justify-center text-center py-16 sm:py-24 px-4">
            <Icon name="shopping_bag" className="text-5xl sm:text-6xl text-outline mb-6" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-3">Your bag is empty</h1>
            <p className="text-on-surface-variant text-sm sm:text-base max-w-md mb-8 leading-relaxed">
              {`Discover pieces from our edit — shipping is complimentary over ${formatGhs(FREE_SHIPPING_THRESHOLD_GHS, 0)}.`}
            </p>
            <Link
              to="/shop"
              className="bg-secondary text-on-secondary px-8 py-3.5 rounded-xl font-label font-bold text-sm uppercase tracking-widest hover:opacity-95 transition-opacity"
            >
              Continue shopping
            </Link>
          </div>
        </StorefrontMain>
      </StorefrontShell>
    );
  }

  return (
    <StorefrontShell>
      <StorefrontMain className="text-on-surface antialiased min-w-0">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 text-sm font-label font-bold uppercase tracking-widest text-secondary hover:underline underline-offset-4 mb-6"
        >
          <Icon name="arrow_back" className="text-lg" />
          Back to shop
        </Link>
        <CheckoutStepBar current={1} />
        <header className="mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-headline font-extrabold tracking-tight text-on-background mb-2">Your bag</h1>
          <p className="text-on-surface-variant font-body max-w-xl text-sm sm:text-base leading-relaxed">
            Review items before checkout. Taxes and shipping follow server evaluation.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 xl:gap-20 items-start">
          <div className="lg:col-span-7 space-y-6 md:space-y-12">
            {summary.lines.map((item) => {
              const itemPending = pendingItemIds.has(item.itemId);
              return (
                <div key={item.itemId} className="flex flex-row gap-4 sm:gap-6 md:gap-8 group">
                  <div className="w-24 sm:w-28 md:w-48 shrink-0 aspect-[4/5] bg-surface-container-low overflow-hidden rounded-lg">
                  <img
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    src={item.image}
                    alt={item.name} loading="lazy" decoding="async" />
                  </div>
                  <div className="flex flex-col flex-grow min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-1 md:mb-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary block">Item</span>
                      <button
                        type="button"
                        onClick={() => void mutateCartLineQuantity(item.itemId, 0)}
                        disabled={itemPending}
                        className="text-outline hover:text-error transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Icon name="close" className="text-sm" />
                      </button>
                    </div>
                    <h3 className="text-base sm:text-lg md:text-2xl font-bold tracking-tight text-on-surface mb-1 line-clamp-2">
                      {item.name}
                    </h3>
                    <div className="mt-auto flex justify-between items-end gap-2 pt-3">
                      <div className="flex items-center bg-surface-container-high rounded-lg p-0.5 sm:p-1">
                        <button
                          type="button"
                          onClick={() => void mutateCartLineQuantity(item.itemId, item.qty - 1)}
                          disabled={itemPending}
                          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-on-surface hover:text-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          aria-label="Decrease quantity"
                        >
                          <Icon name="remove" />
                        </button>
                        <span className="w-8 sm:w-10 text-center text-sm sm:text-base font-bold text-on-surface tabular-nums">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => void mutateCartLineQuantity(item.itemId, item.qty + 1)}
                          disabled={itemPending}
                          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-on-surface hover:text-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          aria-label="Increase quantity"
                        >
                          <Icon name="add" />
                        </button>
                      </div>
                      <span className="text-base sm:text-lg md:text-xl font-bold text-on-surface tabular-nums shrink-0">
                        {formatGhs(item.price)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-5">
            <div className="bg-surface-container-low rounded-xl p-8 lg:p-12 sticky top-32">
              <h2 className="text-3xl font-bold tracking-tight text-on-surface mb-8">Summary</h2>
              <div className="space-y-6 mb-10 pb-10 border-b border-outline-variant/20">
                <div className="flex justify-between items-center text-on-surface-variant">
                  <span className="font-body">Subtotal</span>
                  <span className="font-bold text-on-surface">{formatGhs(summary.subtotalGhs)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center mb-10">
                <span className="text-xl font-bold tracking-tight">Total</span>
                <span className="text-3xl font-extrabold tracking-tighter text-primary">{formatGhs(summary.totalGhs)}</span>
              </div>
              {showHiddenDeltaHint ? (
                <p className="text-[11px] text-on-surface-variant -mt-7 mb-8">
                  Total includes backend adjustments that are not broken out in this summary.
                </p>
              ) : null}
              <div className="mb-8">
                <label className="text-[10px] uppercase tracking-widest font-bold text-outline block mb-3">Add Coupon</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    disabled={couponLocked}
                    className={`w-full sm:flex-grow rounded-lg px-4 py-3 ${neutralFieldClass}`}
                    placeholder="CODE2024"
                    type="text"
                  />
                  <button
                    type="button"
                    disabled={couponLocked || applyCouponMut.isPending}
                    onClick={() => void applyCouponMut.mutateAsync(coupon)}
                    className="w-full sm:w-auto bg-primary text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {couponLocked ? "Applied" : applyCouponMut.isPending ? "Applying..." : "Apply"}
                  </button>
                </div>
                {couponOutcome?.valid ? (
                  <p className="text-secondary text-xs mt-2 font-medium">
                    {typeof couponOutcome.discountCents === "number" && couponOutcome.discountCents > 0
                      ? `Coupon ${couponOutcome.appliedCode ?? "applied"} • -${formatGhs(couponOutcome.discountCents / 100)}`
                      : `Coupon ${couponOutcome.appliedCode ?? "applied"} applied`}
                    {couponOutcome.message ? ` — ${couponOutcome.message}` : ""}
                  </p>
                ) : couponOutcome?.message ? (
                  <p className="text-on-surface-variant text-xs mt-2">{couponOutcome.message}</p>
                ) : null}
                {couponLocked ? (
                  <button
                    type="button"
                    onClick={() => void removeCouponMut.mutateAsync()}
                    disabled={removeCouponMut.isPending}
                    className="text-xs mt-2 text-on-surface-variant hover:text-on-surface underline underline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {removeCouponMut.isPending ? "Removing coupon..." : "Remove coupon"}
                  </button>
                ) : null}
                {couponErr ? <p className="text-error text-xs mt-2">{couponErr}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  getOrCreateCheckoutIdempotencyKey();
                  navigate("/checkout/shipping");
                }}
                className="w-full bg-secondary text-on-secondary py-4 sm:py-4 rounded-xl font-label font-bold text-sm sm:text-base uppercase tracking-wide hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
              >
                Proceed to checkout
                <Icon name="arrow_forward" />
              </button>
              <Link
                to="/shop"
                className="mt-4 w-full flex items-center justify-center py-3.5 rounded-xl border-2 border-outline-variant/25 text-on-surface font-label font-bold text-sm uppercase tracking-wide hover:border-secondary/40 hover:text-secondary transition-colors"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      </StorefrontMain>
    </StorefrontShell>
  );
};

/* ─────────────────────────────────────────────
   CHECKOUT SHIPPING — matches checkout_shipping/code.html
───────────────────────────────────────────── */
const shippingSchema = z.object({
  fullName: z.string().min(2, "Name required"),
  email: z.union([z.string().email("Invalid email"), z.literal("")]).optional(),
  address: z.string().min(5, "Address required"),
  city: z.string().min(2, "City required"),
  zip: z.string().min(1, "Postal code required"),
  phone: z.string().min(7, "Phone required")
});

export const CheckoutShippingPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cartQueryKey = useCustomerCartQueryKey();
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);
  const prior = readCheckoutDraft();
  const [selectedMethod, setSelectedMethod] = useState<string>(prior?.shippingMethodCode ?? "PAY_ON_DELIVERY");
  const [addressMode, setAddressMode] = useState<"saved" | "new">(isAuthenticated ? "saved" : "new");
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string>("");

  const { register, handleSubmit, formState: { errors }, setError, setValue } = useForm({
    resolver: zodResolver(shippingSchema),
    defaultValues: {
      fullName: prior?.address.fullName ?? "",
      email: prior?.address.email ?? "",
      address: prior?.address.line1 ?? "",
      city: prior?.address.city ?? "",
      zip: prior?.address.postalCode ?? "",
      phone: prior?.address.phone ?? ""
    }
  });

  const addressesQuery = useQuery({
    queryKey: ["account", "addresses"],
    queryFn: async () => {
      const res = await customerBackendApi.listAddresses();
      return (res.data as { items?: AccountAddressRow[] }).items ?? [];
    },
    enabled: isAuthenticated
  });

  const cartQuery = useQuery({
    queryKey: cartQueryKey,
    queryFn: async () => {
      const { data } = await customerBackendApi.getCart();
      return data;
    },
    staleTime: 30_000
  });
  const summary = mapCartEvaluationToOrderSummary(cartQuery.data);
  const orderLines = summary.lines.map((l) => ({
    name: l.name,
    variant: l.variant,
    qty: l.qty,
    price: l.price,
    image: l.image
  }));
  const couponOutcome = summary.couponOutcome;

  const effectiveShippingOptions = useMemo(
    () => buildEffectiveShippingOptions(cartQuery.data, summary.subtotalGhs),
    [cartQuery.data, summary.subtotalGhs]
  );

  const selectedShippingOption =
    effectiveShippingOptions.find((option) => option.code === selectedMethod) ?? effectiveShippingOptions[0] ?? null;
  const selectedShippingCents = selectedShippingOption?.amountCents ?? summary.shippingCents;
  const discountGhs =
    couponOutcome?.valid && typeof couponOutcome.discountCents === "number" ? couponOutcome.discountCents / 100 : 0;
  const shippingTotalGhs =
    Math.round((summary.subtotalGhs - discountGhs + selectedShippingCents / 100 + summary.taxGhs) * 100) / 100;
  const savedAddresses = addressesQuery.data ?? [];
  const usingSavedAddress = isAuthenticated && addressMode === "saved" && savedAddresses.length > 0;

  useEffect(() => {
    if (effectiveShippingOptions.length === 0) return;
    if (effectiveShippingOptions.some((option) => option.code === selectedMethod)) return;
    setSelectedMethod(effectiveShippingOptions[0].code);
  }, [effectiveShippingOptions, selectedMethod]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAddressMode("new");
      return;
    }
    if (savedAddresses.length === 0) {
      setAddressMode("new");
      return;
    }
    const initial =
      savedAddresses.find((address) => address.id === selectedSavedAddressId) ??
      savedAddresses.find((address) => address.isDefaultShipping) ??
      savedAddresses[0];
    if (initial && selectedSavedAddressId !== initial.id) {
      setSelectedSavedAddressId(initial.id);
    }
  }, [isAuthenticated, savedAddresses, selectedSavedAddressId]);

  useEffect(() => {
    if (!isAuthenticated || addressMode !== "saved") return;
    const selectedAddress = savedAddresses.find((address) => address.id === selectedSavedAddressId);
    if (!selectedAddress) return;
    setValue("fullName", selectedAddress.fullName);
    setValue("address", selectedAddress.addressLine1);
    setValue("city", selectedAddress.city);
    setValue("zip", selectedAddress.postalCode ?? "N/A");
  }, [addressMode, isAuthenticated, savedAddresses, selectedSavedAddressId, setValue]);

  const checkoutAuthFlipRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (checkoutAuthFlipRef.current === undefined) {
      checkoutAuthFlipRef.current = isAuthenticated;
      return;
    }
    if (checkoutAuthFlipRef.current === isAuthenticated) {
      return;
    }
    checkoutAuthFlipRef.current = isAuthenticated;
    const draft = readCheckoutDraft();
    void queryClient.invalidateQueries({ queryKey: [CUSTOMER_CART_QUERY_ROOT] });
    if (!draft) {
      return;
    }
    void customerBackendApi
      .validateCheckout({
        address: draft.address,
        shippingMethodCode: draft.shippingMethodCode
      })
      .catch(() => {
        return null;
      });
  }, [isAuthenticated, queryClient]);

  return (
    <div className="bg-background font-body text-on-background antialiased">
      <CheckoutHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-20 pb-28 md:pb-20 lg:flex lg:gap-16 w-full min-w-0 overflow-x-hidden">
        <div className="lg:flex-1">
          <CheckoutStepBar current={2} />
          <section className="space-y-12">
            <div>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight mb-2">Shipping Details</h1>
              <p className="text-on-surface-variant">Enter your destination to see available delivery options.</p>
            </div>
            <form
              onSubmit={handleSubmit((data) => {
                if (!isAuthenticated && !String(data.email ?? "").trim()) {
                  setError("email", { message: "Email is required for guest checkout." });
                  return;
                }
                const email = String(data.email ?? "").trim();
                const selectedAddress =
                  isAuthenticated && addressMode === "saved"
                    ? savedAddresses.find((address) => address.id === selectedSavedAddressId)
                    : undefined;
                if (isAuthenticated && addressMode === "saved" && !selectedAddress) {
                  setError("address", { message: "Select a saved address or enter a new one." });
                  return;
                }
                writeCheckoutDraft({
                  address: {
                    fullName: selectedAddress?.fullName ?? data.fullName,
                    email: email || prior?.address.email || undefined,
                    phone: data.phone,
                    country: selectedAddress?.country || "Ghana",
                    region: selectedAddress?.region || selectedAddress?.city || data.city,
                    city: selectedAddress?.city ?? data.city,
                    line1: selectedAddress?.addressLine1 ?? data.address,
                    line2: selectedAddress?.addressLine2 ?? undefined,
                    postalCode: selectedAddress?.postalCode ?? data.zip
                  },
                  shippingMethodCode: selectedShippingOption?.code ?? selectedMethod,
                  payment: prior?.payment ?? { channel: "card" }
                });
                navigate("/checkout/payment");
              })}
              className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8"
            >
              {isAuthenticated ? (
                <div className="md:col-span-2 pt-2">
                  <h2 className="font-headline text-xl font-bold tracking-tight mb-4">Address</h2>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => setAddressMode("saved")}
                      className={`px-4 py-2.5 rounded-lg border text-sm font-bold ${
                        addressMode === "saved"
                          ? "border-secondary text-secondary bg-secondary/5"
                          : "border-outline-variant/30 text-on-surface-variant"
                      }`}
                    >
                      Select saved address
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddressMode("new")}
                      className={`px-4 py-2.5 rounded-lg border text-sm font-bold ${
                        addressMode === "new"
                          ? "border-secondary text-secondary bg-secondary/5"
                          : "border-outline-variant/30 text-on-surface-variant"
                      }`}
                    >
                      Enter new address
                    </button>
                  </div>
                  {addressMode === "saved" && savedAddresses.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 mt-4">
                      {savedAddresses.map((address) => (
                        <label
                          key={address.id}
                          className={`cursor-pointer rounded-xl border p-4 ${
                            selectedSavedAddressId === address.id
                              ? "border-secondary bg-secondary/5"
                              : "border-outline-variant/25"
                          }`}
                        >
                          <input
                            type="radio"
                            name="savedAddress"
                            value={address.id}
                            checked={selectedSavedAddressId === address.id}
                            onChange={() => setSelectedSavedAddressId(address.id)}
                            className="hidden"
                          />
                          <p className="font-bold text-sm">{address.label?.trim() || "Saved address"}</p>
                          <p className="text-xs text-on-surface-variant mt-1">
                            {address.fullName} · {address.addressLine1} · {address.city}
                            {address.postalCode ? `, ${address.postalCode}` : ""}
                          </p>
                        </label>
                      ))}
                    </div>
                  ) : addressMode === "saved" ? (
                    <p className="mt-4 text-sm text-on-surface-variant">
                      No saved addresses found. Switch to "Enter new address" to continue.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="md:col-span-2 space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Full Name</label>
                <input
                  {...register("fullName")}
                  disabled={usingSavedAddress}
                  className={`w-full rounded-lg px-4 py-4 ${neutralFieldClass}`}
                  placeholder="Julianne Moore"
                  type="text"
                />
                {errors.fullName && <p className="text-xs text-error">{errors.fullName.message}</p>}
              </div>
              {!isAuthenticated ? (
                <div className="md:col-span-2 space-y-2">
                  <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Email</label>
                  <input {...register("email")} className={`w-full rounded-lg px-4 py-4 ${neutralFieldClass}`} placeholder="name@example.com" type="email" />
                  {errors.email && <p className="text-xs text-error">{errors.email.message}</p>}
                </div>
              ) : null}
              <div className="md:col-span-2 space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Address</label>
                <input
                  {...register("address")}
                  disabled={usingSavedAddress}
                  className={`w-full rounded-lg px-4 py-4 ${neutralFieldClass}`}
                  placeholder="Street, area, landmark"
                  type="text"
                />
                {errors.address && <p className="text-xs text-error">{errors.address.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">City</label>
                <input
                  {...register("city")}
                  disabled={usingSavedAddress}
                  className={`w-full rounded-lg px-4 py-4 ${neutralFieldClass}`}
                  placeholder="Accra"
                  type="text"
                />
                {errors.city && <p className="text-xs text-error">{errors.city.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Zip Code</label>
                <input
                  {...register("zip")}
                  disabled={usingSavedAddress}
                  className={`w-full rounded-lg px-4 py-4 ${neutralFieldClass}`}
                  placeholder="GA-000-0000"
                  type="text"
                />
                {errors.zip && <p className="text-xs text-error">{errors.zip.message}</p>}
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Phone</label>
                <input {...register("phone")} className={`w-full rounded-lg px-4 py-4 ${neutralFieldClass}`} placeholder="+1 (555) 000-0000" type="tel" />
                {errors.phone && <p className="text-xs text-error">{errors.phone.message}</p>}
              </div>

              {/* Shipping Methods */}
              <div className="md:col-span-2 pt-8">
                <h2 className="font-headline text-xl font-bold tracking-tight mb-6">Delivery Method</h2>
                <div className="grid grid-cols-1 gap-4">
                  {effectiveShippingOptions.map((method) => (
                    <label
                      key={method.code}
                      className={`group cursor-pointer relative flex items-center justify-between p-6 bg-surface-container-lowest rounded-xl transition-all shadow-sm border-2 ${
                        selectedMethod === method.code ? "border-secondary" : "border-transparent hover:border-secondary/20"
                      }`}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        value={method.code}
                        checked={selectedMethod === method.code}
                        onChange={() => setSelectedMethod(method.code)}
                        className="hidden"
                      />
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center">
                          <Icon name={method.code === "PAY_ON_DELIVERY" ? "local_shipping" : "payments"} className="text-secondary" />
                        </div>
                        <div>
                          <p className="font-bold">{method.label}</p>
                          <p className="text-sm text-on-surface-variant">
                            {method.code === "PAY_ON_DELIVERY"
                              ? "Pay the courier when your order is delivered."
                              : `Shipping fee: ${formatGhs(method.amountCents / 100)}.`}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-secondary">{formatGhs(method.amountCents / 100)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 pt-8 flex flex-col sm:flex-row justify-stretch sm:justify-end gap-3">
                <button
                  type="submit"
                  className="bg-secondary text-on-secondary px-8 sm:px-12 py-4 rounded-md font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-opacity w-full sm:w-auto"
                >
                  Proceed to Payment
                  <Icon name="arrow_forward" className="text-base" />
                </button>
              </div>
            </form>
          </section>
        </div>
        <CheckoutOrderSummary
          items={orderLines}
          subtotal={summary.subtotalGhs}
          shipping={formatGhs(selectedShippingCents / 100)}
          tax={summary.taxGhs}
          total={shippingTotalGhs}
          showPromoInput={!couponOutcome?.valid}
          couponDescription={
            couponOutcome?.valid
              ? `${couponOutcome.appliedCode ?? "Coupon"} applied${
                  typeof couponOutcome.discountCents === "number" && couponOutcome.discountCents > 0
                    ? ` • -${formatGhs(couponOutcome.discountCents / 100)}`
                    : ""
                }${couponOutcome.message ? ` — ${couponOutcome.message}` : ""}`
              : undefined
          }
        />
      </main>
      {/* Mobile step nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-end min-h-[4.25rem] px-1 py-2 safe-area-pb bg-white/80 backdrop-blur-xl border-t border-slate-200/20 shadow-[0_-10px_40px_rgba(11,28,48,0.06)]">
        {[
          { icon: "shopping_cart", label: "Cart", active: false },
          { icon: "local_shipping", label: "Ship", active: true },
          { icon: "payments", label: "Pay", active: false },
          { icon: "fact_check", label: "Review", active: false },
        ].map(({ icon, label, active }) => (
          <div key={label} className={`flex flex-col items-center justify-center font-inter text-[10px] uppercase tracking-widest font-bold ${active ? "text-secondary" : "text-slate-400 opacity-60"}`}>
            <Icon name={icon} filled={active} className="mb-1" />
            <span>{label}</span>
          </div>
        ))}
      </nav>
      <CheckoutFooter />
    </div>
  );
};

/* ─────────────────────────────────────────────
   CHECKOUT PAYMENT — matches checkout_payment/code.html
───────────────────────────────────────────── */
export const CheckoutPaymentPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cartQueryKey = useCustomerCartQueryKey();
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);
  const draft = readCheckoutDraft();
  const [method, setMethod] = useState<"paystack_card" | "paystack_mobile_money">("paystack_card");
  const [billingSame, setBillingSame] = useState(draft?.billingSameAsShipping ?? true);
  const [mmNetwork, setMmNetwork] = useState<"mtn" | "telecel" | "airteltigo">("mtn");
  const [mmPhone, setMmPhone] = useState("");
  const {
    register: registerBilling,
    getValues: getBillingValues,
    formState: { errors: billingErrors },
    setError: setBillingError,
    clearErrors: clearBillingErrors
  } = useForm<{
    fullName: string;
    email: string;
    address: string;
    city: string;
    zip: string;
    phone: string;
  }>({
    defaultValues: {
      fullName: draft?.billingAddress?.fullName ?? draft?.address.fullName ?? "",
      email: draft?.billingAddress?.email ?? draft?.address.email ?? "",
      address: draft?.billingAddress?.line1 ?? draft?.address.line1 ?? "",
      city: draft?.billingAddress?.city ?? draft?.address.city ?? "",
      zip: draft?.billingAddress?.postalCode ?? draft?.address.postalCode ?? "",
      phone: draft?.billingAddress?.phone ?? draft?.address.phone ?? ""
    }
  });

  const cartQuery = useQuery({
    queryKey: cartQueryKey,
    queryFn: async () => {
      const { data } = await customerBackendApi.getCart();
      return data;
    },
    staleTime: 30_000
  });
  const summary = mapCartEvaluationToOrderSummary(cartQuery.data);
  const orderLines = summary.lines.map((l) => ({
    name: l.name,
    variant: l.variant,
    qty: l.qty,
    price: l.price,
    image: l.image
  }));
  const couponOutcome = summary.couponOutcome;
  const effectiveShippingOptions = useMemo(
    () => buildEffectiveShippingOptions(cartQuery.data, summary.subtotalGhs),
    [cartQuery.data, summary.subtotalGhs]
  );
  const selectedShippingOption =
    effectiveShippingOptions.find((option) => option.code === draft?.shippingMethodCode) ??
    effectiveShippingOptions[0] ??
    null;
  const selectedShippingCents = selectedShippingOption?.amountCents ?? summary.shippingCents;
  const discountGhs =
    couponOutcome?.valid && typeof couponOutcome.discountCents === "number" ? couponOutcome.discountCents / 100 : 0;
  const paymentTotalGhs =
    Math.round((summary.subtotalGhs - discountGhs + selectedShippingCents / 100 + summary.taxGhs) * 100) / 100;

  useEffect(() => {
    if (!readCheckoutDraft()) {
      navigate("/checkout/shipping", { replace: true });
    }
  }, [navigate]);

  const checkoutAuthFlipRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (checkoutAuthFlipRef.current === undefined) {
      checkoutAuthFlipRef.current = isAuthenticated;
      return;
    }
    if (checkoutAuthFlipRef.current === isAuthenticated) {
      return;
    }
    checkoutAuthFlipRef.current = isAuthenticated;
    const draft = readCheckoutDraft();
    void queryClient.invalidateQueries({ queryKey: [CUSTOMER_CART_QUERY_ROOT] });
    if (!draft) {
      return;
    }
    void customerBackendApi
      .validateCheckout({
        address: draft.address,
        shippingMethodCode: draft.shippingMethodCode
      })
      .catch(() => {
        return null;
      });
  }, [isAuthenticated, queryClient]);

  return (
    <div className="bg-surface text-on-surface antialiased">
      <CheckoutHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-20 pb-32 md:pb-20 min-h-screen w-full min-w-0 overflow-x-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          <div className="lg:col-span-7 xl:col-span-8">
            <section className="mb-12">
              <h1 className="text-4xl md:text-5xl font-extrabold font-headline tracking-tight text-on-surface mb-2">Finalize Payment</h1>
              <p className="text-on-surface-variant text-lg">Pay with card or mobile money. All payments are processed securely by Paystack.</p>
            </section>
            <CheckoutStepBar current={3} />

            <div className="space-y-10">
              {/* Method Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className={`relative flex items-center p-6 cursor-pointer rounded-xl transition-all shadow-sm ${method === "paystack_card" ? "bg-surface-container-lowest ring-2 ring-secondary" : "bg-surface-container-low hover:bg-surface-container"}`}>
                  <input type="radio" name="payment_method" value="paystack_card" checked={method === "paystack_card"} onChange={() => setMethod("paystack_card")} className="hidden" />
                  <div className="flex flex-col gap-1 min-w-0 pr-2">
                    <span className="font-bold text-on-surface">Card</span>
                    <span className="text-xs text-on-surface-variant">Visa &amp; Mastercard</span>
                    <span className="text-[10px] font-label uppercase tracking-widest text-outline mt-1">Paystack</span>
                  </div>
                  <Icon name="credit_card" className={`ml-auto shrink-0 ${method === "paystack_card" ? "text-secondary" : "text-on-surface-variant"}`} />
                </label>
                <label className={`relative flex items-center p-6 cursor-pointer rounded-xl transition-all ${method === "paystack_mobile_money" ? "bg-surface-container-lowest ring-2 ring-secondary" : "bg-surface-container-low hover:bg-surface-container"}`}>
                  <input type="radio" name="payment_method" value="paystack_mobile_money" checked={method === "paystack_mobile_money"} onChange={() => setMethod("paystack_mobile_money")} className="hidden" />
                  <div className="flex flex-col gap-1 min-w-0 pr-2">
                    <span className="font-bold text-on-surface">Mobile money</span>
                    <span className="text-xs text-on-surface-variant">MTN · Telecel · AirtelTigo</span>
                    <span className="text-[10px] font-label uppercase tracking-widest text-outline mt-1">Paystack</span>
                  </div>
                  <Icon name="smartphone" className={`ml-auto shrink-0 ${method === "paystack_mobile_money" ? "text-secondary" : "text-on-surface-variant"}`} />
                </label>
              </div>

              {/* Card Form */}
              {method === "paystack_card" && (
                <div className="bg-surface-container-low p-8 md:p-10 rounded-xl space-y-6">
                  {[
                    { label: "Cardholder Name", placeholder: "ALEXANDER VOGUE", type: "text" },
                    { label: "Card Number", placeholder: "0000 0000 0000 0000", type: "text" },
                  ].map(({ label, placeholder, type }) => (
                    <div key={label} className="space-y-2">
                      <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">{label}</label>
                      <input className={`w-full rounded-md px-4 py-3 ${neutralFieldClass}`} placeholder={placeholder} type={type} />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { label: "Expiry Date", placeholder: "MM / YY" },
                      { label: "CVV", placeholder: "123" },
                    ].map(({ label, placeholder }) => (
                      <div key={label} className="space-y-2">
                        <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">{label}</label>
                        <input className={`w-full rounded-md px-4 py-3 ${neutralFieldClass}`} placeholder={placeholder} type="text" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {method === "paystack_mobile_money" && (
                <div className="bg-surface-container-low p-8 md:p-10 rounded-xl space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">Mobile network</label>
                    <select
                      value={mmNetwork}
                      onChange={(e) => setMmNetwork(e.target.value as typeof mmNetwork)}
                      className={`w-full rounded-md px-4 py-3 font-body text-zinc-900 ${neutralFieldClass}`}
                    >
                      <option value="mtn">MTN</option>
                      <option value="telecel">Telecel</option>
                      <option value="airteltigo">AirtelTigo</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">Mobile money number</label>
                    <input
                      value={mmPhone}
                      onChange={(e) => setMmPhone(e.target.value)}
                      className={`w-full rounded-md px-4 py-3 ${neutralFieldClass}`}
                      placeholder="0XX XXX XXXX"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    You will confirm payment on your phone. Charges appear as Paystack / {STORE_NAME_FULL}.
                  </p>
                </div>
              )}

              {/* Billing Toggle */}
              <div className="flex items-center justify-between p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                <div className="flex flex-col">
                  <span className="font-bold text-on-surface">Billing Address</span>
                  <span className="text-sm text-on-surface-variant">Same as shipping address</span>
                </div>
                <button
                  onClick={() => {
                    const next = !billingSame;
                    setBillingSame(next);
                    if (next) {
                      clearBillingErrors();
                    }
                  }}
                  className={`w-12 h-6 rounded-full relative flex items-center px-1 transition-colors ${billingSame ? "bg-secondary" : "bg-surface-container-high"}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all ${billingSame ? "ml-auto" : ""}`} />
                </button>
              </div>

              {!billingSame ? (
                <div className="bg-surface-container-low p-8 md:p-10 rounded-xl space-y-6">
                  <h3 className="font-headline text-lg font-bold tracking-tight">New billing address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">Full Name</label>
                      <input {...registerBilling("fullName")} className={`w-full rounded-md px-4 py-3 ${neutralFieldClass}`} type="text" />
                      {billingErrors.fullName ? <p className="text-xs text-error">{billingErrors.fullName.message}</p> : null}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">Email</label>
                      <input {...registerBilling("email")} className={`w-full rounded-md px-4 py-3 ${neutralFieldClass}`} type="email" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">Address</label>
                      <input {...registerBilling("address")} className={`w-full rounded-md px-4 py-3 ${neutralFieldClass}`} type="text" />
                      {billingErrors.address ? <p className="text-xs text-error">{billingErrors.address.message}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">City</label>
                      <input {...registerBilling("city")} className={`w-full rounded-md px-4 py-3 ${neutralFieldClass}`} type="text" />
                      {billingErrors.city ? <p className="text-xs text-error">{billingErrors.city.message}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">Zip Code</label>
                      <input {...registerBilling("zip")} className={`w-full rounded-md px-4 py-3 ${neutralFieldClass}`} type="text" />
                      {billingErrors.zip ? <p className="text-xs text-error">{billingErrors.zip.message}</p> : null}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">Phone</label>
                      <input {...registerBilling("phone")} className={`w-full rounded-md px-4 py-3 ${neutralFieldClass}`} type="tel" />
                      {billingErrors.phone ? <p className="text-xs text-error">{billingErrors.phone.message}</p> : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex flex-col md:flex-row items-center gap-6 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    const d = readCheckoutDraft();
                    if (!d) {
                      navigate("/checkout/shipping");
                      return;
                    }
                    let billingAddress = d.billingAddress;
                    if (!billingSame) {
                      const billing = getBillingValues();
                      const requiredFields: Array<keyof typeof billing> = ["fullName", "address", "city", "zip", "phone"];
                      let hasValidationError = false;
                      for (const field of requiredFields) {
                        if (!String(billing[field] ?? "").trim()) {
                          hasValidationError = true;
                          setBillingError(field, { message: "Required" });
                        }
                      }
                      if (hasValidationError) {
                        return;
                      }
                      billingAddress = {
                        fullName: billing.fullName.trim(),
                        email: billing.email.trim() || undefined,
                        phone: billing.phone.trim(),
                        country: d.address.country,
                        region: billing.city.trim(),
                        city: billing.city.trim(),
                        line1: billing.address.trim(),
                        postalCode: billing.zip.trim()
                      };
                    }
                    const channel: "card" | "mobile_money" = method === "paystack_card" ? "card" : "mobile_money";
                    const mobileMoney =
                      channel === "mobile_money"
                        ? { phone: mmPhone.trim(), provider: mmNetwork }
                        : undefined;
                    writeCheckoutDraft({
                      ...d,
                      billingSameAsShipping: billingSame,
                      billingAddress: billingSame ? undefined : billingAddress,
                      payment: { channel, mobileMoney }
                    });
                    navigate("/checkout/review");
                  }}
                  className="w-full md:w-auto px-10 py-4 bg-gradient-to-r from-secondary to-secondary-container text-on-secondary font-bold rounded-md shadow-lg shadow-secondary/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                >
                  <span>Continue to review</span>
                  <Icon name="arrow_forward" className="text-sm" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/checkout/shipping")}
                  className="text-on-surface-variant font-medium hover:text-secondary transition-colors underline decoration-outline-variant/30 underline-offset-8"
                >
                  Return to Shipping
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 xl:col-span-4">
            <CheckoutOrderSummary
              items={orderLines}
              subtotal={summary.subtotalGhs}
              shipping={formatGhs(selectedShippingCents / 100)}
              tax={summary.taxGhs}
              total={paymentTotalGhs}
              showPromoInput={!couponOutcome?.valid}
              couponDescription={
                couponOutcome?.valid
                  ? `${couponOutcome.appliedCode ?? "Coupon"} applied${
                      typeof couponOutcome.discountCents === "number" && couponOutcome.discountCents > 0
                        ? ` • -${formatGhs(couponOutcome.discountCents / 100)}`
                        : ""
                    }${couponOutcome.message ? ` — ${couponOutcome.message}` : ""}`
                  : undefined
              }
            />
          </div>
        </div>
      </main>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-end min-h-[4.25rem] px-1 py-2 safe-area-pb bg-white/80 backdrop-blur-xl border-t border-slate-200/20">
        {[
          { icon: "shopping_cart", label: "Cart" },
          { icon: "local_shipping", label: "Ship" },
          { icon: "payments", label: "Pay", active: true },
          { icon: "fact_check", label: "Review" },
        ].map(({ icon, label, active }) => (
          <div
            key={label}
            className={`flex flex-col items-center justify-center font-inter text-[9px] uppercase tracking-widest font-bold ${
              active ? "text-secondary" : "text-slate-400 opacity-60"
            }`}
          >
            <Icon name={icon} filled={Boolean(active)} className="mb-1" />
            <span>{label}</span>
          </div>
        ))}
      </nav>
      <CheckoutFooter />
    </div>
  );
};

/* ─────────────────────────────────────────────
   CHECKOUT REVIEW — final confirmation before submit
───────────────────────────────────────────── */

/** Paystack / provider may expose the hosted URL as `redirectUrl` or only under `providerPayload`. */
const extractPaymentHostedUrl = (payment: unknown): string | null => {
  if (!payment || typeof payment !== "object" || Array.isArray(payment)) {
    return null;
  }
  const p = payment as Record<string, unknown>;
  const direct = p.redirectUrl ?? p.redirect_url;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }
  const rawPayload = p.providerPayload ?? p.provider_payload;
  if (rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)) {
    const pl = rawPayload as Record<string, unknown>;
    const auth = pl.authorizationUrl ?? pl.authorization_url;
    if (typeof auth === "string" && auth.trim().length > 0) {
      return auth.trim();
    }
  }
  return null;
};

const ORDER_STATUSES_ALREADY_PAID = new Set(["CONFIRMED", "PROCESSING", "COMPLETED"]);

export const CheckoutReviewPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cartQueryKey = useCustomerCartQueryKey();
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const placeOrderInFlight = useRef(false);
  const draft = readCheckoutDraft();

  const cartQuery = useQuery({
    queryKey: cartQueryKey,
    queryFn: async () => {
      const { data } = await customerBackendApi.getCart();
      return data;
    },
    staleTime: 30_000
  });
  const summary = mapCartEvaluationToOrderSummary(cartQuery.data);
  const orderLines = summary.lines.map((l) => ({
    name: l.name,
    variant: l.variant,
    qty: l.qty,
    price: l.price,
    image: l.image
  }));

  useEffect(() => {
    if (!readCheckoutDraft()) {
      navigate("/checkout/shipping", { replace: true });
    }
  }, [navigate]);

  const checkoutAuthFlipRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (checkoutAuthFlipRef.current === undefined) {
      checkoutAuthFlipRef.current = isAuthenticated;
      return;
    }
    if (checkoutAuthFlipRef.current === isAuthenticated) {
      return;
    }
    checkoutAuthFlipRef.current = isAuthenticated;
    const d = readCheckoutDraft();
    void queryClient.invalidateQueries({ queryKey: [CUSTOMER_CART_QUERY_ROOT] });
    if (!d) {
      return;
    }
    void customerBackendApi
      .validateCheckout({
        address: d.address,
        shippingMethodCode: d.shippingMethodCode
      })
      .catch(() => {
        return null;
      });
  }, [isAuthenticated, queryClient]);

  const shipBlock = draft
    ? `${draft.address.fullName}\n${draft.address.line1}\n${draft.address.city}, ${draft.address.postalCode}\n${draft.address.country}`
    : "";

  const payLabel =
    draft?.payment.channel === "mobile_money"
      ? `Mobile money (${draft.payment.mobileMoney?.provider ?? "network"}) — Paystack`
      : "Card — Paystack";

  const placeOrder = async () => {
    const d = readCheckoutDraft();
    if (!d) {
      navigate("/checkout/shipping");
      return;
    }
    if (placeOrderInFlight.current) {
      return;
    }
    // Abandoned Paystack (closed tab / no callback): stale result + cko would replay the same hosted payment.
    const staleDeferred = readCheckoutResult();
    if (
      staleDeferred?.checkoutPaymentIntentId &&
      staleDeferred?.paymentId &&
      !staleDeferred?.orderNumber
    ) {
      resetCheckoutAttemptClientState();
    }
    placeOrderInFlight.current = true;
    setBusy(true);
    setErr(null);
    try {
      const checkoutIdempotencyKey = getOrCreateCheckoutIdempotencyKey();
      const paymentIdempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? `pay_${crypto.randomUUID()}` : `pay_${Date.now()}`;
      const { data } = await customerBackendApi.completeCheckout({
        checkoutIdempotencyKey,
        address: d.address,
        shippingMethodCode: d.shippingMethodCode,
        paymentIdempotencyKey,
        channel: d.payment.channel,
        mobileMoney: d.payment.mobileMoney
      });
      const entity = data.order as { id: string; orderNumber: string; status?: string } | null;
      const checkoutPaymentIntentId = data.checkoutPaymentIntentId as string;
      const pay = data.payment;
      if (!entity && (pay === null || pay === undefined)) {
        setErr("Checkout could not start payment. Please try again.");
        return;
      }
      const payRecord = pay && typeof pay === "object" && !Array.isArray(pay) ? (pay as Record<string, unknown>) : null;
      const payId = typeof payRecord?.id === "string" ? payRecord.id : "";
      const paymentState =
        typeof payRecord?.paymentState === "string"
          ? payRecord.paymentState
          : typeof payRecord?.payment_state === "string"
            ? payRecord.payment_state
            : undefined;
      const hostedPayUrl = extractPaymentHostedUrl(pay);
      const requiresRedirect = Boolean(payRecord?.requiresRedirect ?? payRecord?.requires_redirect);

      const baseResult = {
        shipToLines: formatShipToLinesFromAddress(d.address),
        shippingMethodLabel: labelForShippingMethodCode(d.shippingMethodCode),
        fulfillmentNote: "We will email tracking and updates as your order moves through fulfillment."
      };

      if (entity) {
        writeCheckoutResult({
          ...baseResult,
          orderId: entity.id,
          orderNumber: entity.orderNumber
        });
      } else {
        if (!payId) {
          setErr("Checkout response was missing payment details. Please try again.");
          return;
        }
        writeCheckoutResult({
          ...baseResult,
          checkoutPaymentIntentId,
          paymentId: payId
        });
      }

      if (entity?.status && ORDER_STATUSES_ALREADY_PAID.has(entity.status)) {
        clearCheckoutDraft();
        resetCheckoutIdempotencyKey();
        navigate("/checkout/success", { replace: true });
        return;
      }

      if (entity?.status && entity.status !== "PENDING_PAYMENT") {
        setErr("This checkout is tied to an order that can no longer accept payment. Return to your cart to start again.");
        return;
      }

      if (paymentState === "PAID" && !hostedPayUrl) {
        clearCheckoutDraft();
        resetCheckoutIdempotencyKey();
        navigate("/checkout/success", { replace: true });
        return;
      }
      if (hostedPayUrl) {
        // Keep draft until success so Paystack cancel/return still has address + payment method for retry.
        window.location.assign(hostedPayUrl);
        return;
      }
      const awaitingProvider =
        paymentState === "AWAITING_CUSTOMER_ACTION" ||
        paymentState === "INITIALIZED" ||
        paymentState === "PENDING_INITIALIZATION";
      if (requiresRedirect || awaitingProvider) {
        setErr(
          "We could not open the secure payment page. Check your connection and try again, or use a different browser if the problem continues."
        );
        return;
      }
      clearCheckoutDraft();
      resetCheckoutIdempotencyKey();
      navigate("/checkout/success");
    } catch (e) {
      setErr(e instanceof CommerceApiError ? e.message : "Checkout failed.");
    } finally {
      placeOrderInFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface antialiased">
      <CheckoutHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-20 pb-28 md:pb-20 lg:flex lg:gap-16 w-full min-w-0 overflow-x-hidden">
        <div className="lg:flex-1">
          <CheckoutStepBar current={4} />
          <section className="space-y-8">
            <div>
              <h1 className="font-headline text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">Review your order</h1>
              <p className="text-on-surface-variant text-sm sm:text-base">
                Confirm items, shipping, and payment before placing your order.
              </p>
            </div>
            <div className="space-y-4 p-5 sm:p-6 bg-surface-container-low rounded-xl border border-outline-variant/20">
              <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-outline">Ship to</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line">{shipBlock}</p>
            </div>
            <div className="space-y-4 p-5 sm:p-6 bg-surface-container-low rounded-xl border border-outline-variant/20">
              <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-outline">Delivery</h2>
              <p className="text-sm">Standard shipping — per server evaluation at payment.</p>
            </div>
            <div className="space-y-4 p-5 sm:p-6 bg-surface-container-low rounded-xl border border-outline-variant/20">
              <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-outline">Payment</h2>
              <p className="text-sm">{payLabel}</p>
            </div>
            {err ? <p className="text-error text-sm">{err}</p> : null}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => void placeOrder()}
                className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-secondary to-secondary-container text-on-secondary font-bold rounded-md shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Icon name="lock" className="text-sm" />
                {busy ? "Placing order…" : "Place order"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/checkout/payment")}
                className="w-full sm:w-auto text-on-surface-variant font-medium hover:text-secondary underline underline-offset-8 py-3"
              >
                Edit payment
              </button>
            </div>
          </section>
        </div>
        <CheckoutOrderSummary
          items={orderLines}
          subtotal={summary.subtotalGhs}
          shipping={summary.shippingCents === 0 ? "Free" : formatGhs(summary.shippingCents / 100)}
          tax={summary.taxGhs}
          total={summary.totalGhs}
        />
      </main>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-end min-h-[4.25rem] px-1 py-2 safe-area-pb bg-white/80 backdrop-blur-xl border-t border-slate-200/20">
        {[
          { icon: "shopping_cart", label: "Cart" },
          { icon: "local_shipping", label: "Ship" },
          { icon: "payments", label: "Pay" },
          { icon: "fact_check", label: "Review", active: true },
        ].map(({ icon, label, active }) => (
          <div
            key={label}
            className={`flex flex-col items-center justify-center font-inter text-[9px] uppercase tracking-widest font-bold ${
              active ? "text-secondary" : "text-slate-400 opacity-60"
            }`}
          >
            <Icon name={icon} filled={Boolean(active)} className="mb-1" />
            <span>{label}</span>
          </div>
        ))}
      </nav>
      <CheckoutFooter />
    </div>
  );
};

/* ─────────────────────────────────────────────
   PAYSTACK RETURN — callback_url carries paymentId + checkoutPaymentIntentId (or legacy orderId + paymentId).
───────────────────────────────────────────── */
export const CheckoutPaymentResultPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("orderId")?.trim() ?? "";
  const checkoutPaymentIntentId = searchParams.get("checkoutPaymentIntentId")?.trim() ?? "";
  const paymentId = searchParams.get("paymentId")?.trim() ?? "";
  const [phase, setPhase] = useState<"loading" | "pending" | "failed" | "auth">("loading");
  const [message, setMessage] = useState<string | null>(null);

  const title =
    phase === "failed"
      ? "Payment could not be confirmed"
      : phase === "auth"
        ? "Session required"
        : "Confirming your payment";

  useEffect(() => {
    if (!paymentId || (!orderId && !checkoutPaymentIntentId)) {
      resetCheckoutAttemptClientState();
      setPhase("failed");
      setMessage("This return link is missing checkout or payment details.");
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 50;
    const pollMs = 500;
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const { data } = await customerBackendApi.getCheckoutPaymentReturn({
          paymentId,
          ...(orderId ? { orderId } : {}),
          ...(checkoutPaymentIntentId ? { checkoutPaymentIntentId } : {})
        });
        if (cancelled) return;
        const prev = readCheckoutResult();
        writeCheckoutResult({
          orderId: data.orderId ?? undefined,
          orderNumber: data.orderNumber ?? undefined,
          checkoutPaymentIntentId:
            (data.checkoutPaymentIntentId ?? checkoutPaymentIntentId) || prev?.checkoutPaymentIntentId || undefined,
          paymentId: data.paymentId,
          shipToLines: prev?.shipToLines,
          shippingMethodLabel: prev?.shippingMethodLabel,
          fulfillmentNote: prev?.fulfillmentNote
        });
        if (data.paymentState === "PAID") {
          if (data.orderNumber) {
            clearCheckoutDraft();
            resetCheckoutIdempotencyKey();
            navigate("/checkout/success", { replace: true });
            return;
          }
          setPhase("pending");
        }
        if (data.paymentState === "FAILED" || data.paymentState === "CANCELLED") {
          resetCheckoutAttemptClientState();
          setPhase("failed");
          setMessage(
            data.paymentState === "FAILED"
              ? "Payment was not completed. You can try again from your cart or contact support with your order number."
              : "This payment was cancelled. You can return to checkout to pay with a different method or an updated cart."
          );
          return;
        }
        setPhase("pending");
        if (attempts >= maxAttempts) {
          setMessage(
            "We have not received final confirmation yet. If Paystack charged you, your order will update shortly — use order tracking with your email."
          );
          return;
        }
        window.setTimeout(tick, pollMs);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof CommerceApiError && (e.status === 401 || e.status === 403)) {
          resetCheckoutAttemptClientState();
          setPhase("auth");
          setMessage("Sign in to the same account you used for checkout, or open this page in the same browser session.");
          return;
        }
        if (e instanceof CommerceApiError && e.status === 404) {
          resetCheckoutAttemptClientState();
          setPhase("failed");
          setMessage(
            "We could not load this order with your current session. Open this link in the same browser you used for checkout, or track your order with your email."
          );
          return;
        }
        setPhase("pending");
        setMessage(e instanceof CommerceApiError ? e.message : "Could not confirm payment.");
        if (attempts < maxAttempts) {
          window.setTimeout(tick, pollMs * 2);
        }
      }
    };

    void tick();
    return () => {
      cancelled = true;
    };
  }, [navigate, orderId, checkoutPaymentIntentId, paymentId]);

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col">
      <CheckoutHeader />
      <main className="flex-1 max-w-lg mx-auto px-6 py-16 text-center space-y-6">
        <Icon name="payments" className="text-5xl text-secondary mx-auto" />
        <h1 className="font-headline text-2xl font-extrabold tracking-tight">{title}</h1>
        {phase === "loading" ? (
          <p className="text-on-surface-variant text-sm">One moment while we sync with Paystack…</p>
        ) : null}
        {phase === "pending" ? (
          <p className="text-on-surface-variant text-sm">
            Payment is still processing on our side. This page will redirect when we receive confirmation.
          </p>
        ) : null}
        {phase === "auth" ? (
          <p className="text-on-surface-variant text-sm">
            <Link to="/login" className="text-secondary font-bold underline underline-offset-4">
              Sign in
            </Link>{" "}
            if you checked out while logged in, or use the same device and browser as when you paid.
          </p>
        ) : null}
        {message ? <p className="text-sm text-on-surface-variant leading-relaxed">{message}</p> : null}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 flex-wrap">
          {phase === "failed" ? (
            <Link
              to="/checkout/review"
              className="text-secondary font-bold text-sm underline underline-offset-4"
            >
              Return to checkout
            </Link>
          ) : null}
          <Link
            to="/track-order"
            className="text-secondary font-bold text-sm underline underline-offset-4"
          >
            Track order
          </Link>
          <Link to="/cart" className="text-on-surface-variant font-medium text-sm underline underline-offset-4">
            Back to cart
          </Link>
        </div>
      </main>
      <CheckoutFooter />
    </div>
  );
};

/* ─────────────────────────────────────────────
   ORDER SUCCESS — matches order_success/code.html
───────────────────────────────────────────── */
export const OrderSuccessPage = () => {
  const result = readCheckoutResult();
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);

  useEffect(() => {
    resetCheckoutIdempotencyKey();
  }, []);
  const orderLabel = result?.orderNumber ? `#${result.orderNumber}` : "your order";
  const rawNum = result?.orderNumber?.replace(/^#/, "").trim() ?? "";
  const trackHref =
    rawNum.length > 0 ? `/track-order?order=${encodeURIComponent(rawNum)}` : "/track-order";
  const accountOrderHref = result?.orderId ? `/account/orders/${result.orderId}` : "/account/orders";
  const shipLines = result?.shipToLines?.filter((l) => l.trim().length > 0) ?? [];
  const shipMethod = result?.shippingMethodLabel?.trim() || null;
  const fulfillmentNote =
    result?.fulfillmentNote?.trim() ||
    "We will email you when your order ships and when tracking is available.";

  return (
  <div className="bg-surface font-body text-on-surface antialiased">
    <nav className="bg-slate-50 sticky top-0 z-50 border-b border-slate-200/80" aria-label="Order confirmation">
      <div className="flex items-center w-full px-6 py-4 max-w-7xl mx-auto">
        <StoreBrandLink to="/" wordmarkClassName="text-slate-900" />
      </div>
    </nav>
    <main className="max-w-7xl mx-auto px-6 py-12 md:py-20 lg:py-24">
      <div className="flex flex-col lg:flex-row gap-16 items-start">
        <div className="w-full lg:w-3/5 space-y-10">
          <header className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase font-label">
              <Icon name="check_circle" filled className="text-sm" />
              Order Confirmed
            </div>
            <h1 className="text-5xl md:text-6xl font-headline font-extrabold tracking-tight text-on-background leading-tight">
              Thank you for <br />your curation.
            </h1>
            <p className="text-lg text-outline leading-relaxed max-w-lg">
              Your order has been received and is being prepared with artisan care at our workshop. We&apos;ll notify you once it&apos;s on its way.
            </p>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-container-low p-8 rounded-xl space-y-2">
              <p className="text-xs font-label uppercase tracking-widest text-on-primary-container font-bold">Order Number</p>
              <p className="text-2xl font-headline font-bold text-on-background">{orderLabel}</p>
            </div>
            <div className="bg-surface-container-low p-8 rounded-xl space-y-2">
              <p className="text-xs font-label uppercase tracking-widest text-on-primary-container font-bold">What happens next</p>
              <p className="text-base font-body font-medium text-on-background leading-relaxed">{fulfillmentNote}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link
              to={isAuthenticated ? accountOrderHref : trackHref}
              className="bg-gradient-to-r from-secondary to-secondary-container text-on-secondary px-8 py-4 rounded-md font-bold tracking-tight text-center hover:opacity-90 transition-opacity"
            >
              {isAuthenticated ? "View order" : "Track your order"}
            </Link>
            <Link to="/shop" className="bg-surface-container-high text-on-surface px-8 py-4 rounded-md font-bold tracking-tight text-center hover:bg-surface-variant transition-colors">
              Continue Shopping
            </Link>
          </div>
          <div className="pt-12 space-y-6">
            <h3 className="text-xs font-label uppercase tracking-widest text-on-primary-container font-bold">Shipping Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
              <div className="space-y-1">
                <p className="font-bold text-on-background">Delivery Address</p>
                {shipLines.length > 0 ? (
                  <p className="text-outline whitespace-pre-line">{shipLines.join("\n")}</p>
                ) : (
                  <p className="text-outline">
                    The address you used at checkout is saved on this order.{" "}
                    {isAuthenticated ? (
                      <Link to={accountOrderHref} className="text-secondary font-semibold underline underline-offset-4">
                        View full details
                      </Link>
                    ) : (
                      <>
                        <Link to={trackHref} className="text-secondary font-semibold underline underline-offset-4">
                          Track this order
                        </Link>{" "}
                        with your email to see shipping details.
                      </>
                    )}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="font-bold text-on-background">Shipping Method</p>
                <p className="text-outline">
                  {shipMethod ?? "Shipping and delivery timing follow the option you selected at checkout."}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full lg:w-2/5 sticky top-32">
          <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-[0_20px_40px_-5px_rgba(11,28,48,0.06)] space-y-8">
            <h2 className="text-xl font-headline font-bold text-on-background">Order Summary</h2>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Line items and final totals are stored with your order.
              {isAuthenticated ? (
                <>
                  {" "}
                  Open{" "}
                  <Link to="/account/orders" className="text-secondary font-bold underline underline-offset-4">
                    Orders
                  </Link>{" "}
                  for full history.
                </>
              ) : (
                <>
                  {" "}
                  <Link to={trackHref} className="text-secondary font-bold underline underline-offset-4">
                    Track this order
                  </Link>{" "}
                  with your order number and checkout email.
                </>
              )}
            </p>
            <div className="bg-surface-container-low p-4 rounded-xl flex items-start gap-3">
              <Icon name="verified" className="text-secondary" />
              <div className="text-xs leading-relaxed text-on-surface-variant">
                <strong>Quality guaranteed.</strong> Every order from {STORE_NAME_FULL} is checked before it leaves our warehouse.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    <footer className="bg-surface-dim mt-24 py-8 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-on-surface-variant text-sm">© 2024 {STORE_NAME_FULL}. All rights reserved.</p>
        <div className="flex gap-8">
          <Link className="text-xs font-bold uppercase tracking-widest text-on-surface hover:text-secondary transition-colors" to="/pages/privacy-policy">Privacy</Link>
          <Link className="text-xs font-bold uppercase tracking-widest text-on-surface hover:text-secondary transition-colors" to="/pages/terms">Terms</Link>
        </div>
      </div>
    </footer>
  </div>
  );
};

/* ─────────────────────────────────────────────
   GUEST TRACKING PAGE
───────────────────────────────────────────── */
export const GuestTrackingPage = () => {
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [entity, setEntity] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get("order")?.trim();
    if (!fromQuery) return;
    setOrderNumber(fromQuery.replace(/^#/, ""));
  }, [searchParams]);

  return (
    <StorefrontShell>
      <StorefrontMain maxWidth={false} className="max-w-xl mx-auto">
        <header className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-headline font-extrabold tracking-tighter mb-3">Track Order</h1>
          <p className="text-on-surface-variant text-sm sm:text-base">Enter your order number and email to see your shipment status.</p>
        </header>
        {!entity ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setErr(null);
              try {
                const { data } = await customerBackendApi.trackGuestOrder({
                  orderNumber: orderNumber.trim(),
                  email: email.trim()
                });
                setEntity(data.entity);
              } catch (error) {
                setErr(error instanceof CommerceApiError ? error.message : "Could not find that order.");
              } finally {
                setBusy(false);
              }
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant block">Order Number</label>
              <input
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className={`w-full rounded-lg px-4 py-4 ${neutralFieldClass}`}
                placeholder="TC-88291"
                type="text"
              />
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant block">Email Address</label>
              <input
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-lg px-4 py-4 ${neutralFieldClass}`}
                placeholder="name@example.com"
                type="email"
              />
            </div>
            {err ? <p className="text-error text-sm">{err}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-secondary text-on-secondary py-4 rounded-md font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy ? "Searching…" : "Track Order"}
            </button>
          </form>
        ) : (
          <div className="bg-surface-container-low p-8 rounded-xl space-y-6">
            <div className="flex items-center gap-3">
              <Icon name="check_circle" filled className="text-secondary text-2xl" />
              <div>
                <p className="font-headline font-bold">
                  Order #
                  {typeof (entity as { orderNumber?: string }).orderNumber === "string"
                    ? (entity as { orderNumber: string }).orderNumber
                    : orderNumber}
                </p>
                <p className="text-sm text-on-surface-variant">Status and tracking details from the server.</p>
              </div>
            </div>
            <pre className="text-xs text-on-surface-variant overflow-x-auto whitespace-pre-wrap break-words">
              {JSON.stringify(entity, null, 2)}
            </pre>
            <button
              type="button"
              onClick={() => {
                setEntity(null);
                setErr(null);
              }}
              className="text-secondary font-bold text-sm uppercase tracking-widest underline"
            >
              Track another order
            </button>
          </div>
        )}
      </StorefrontMain>
    </StorefrontShell>
  );
};
