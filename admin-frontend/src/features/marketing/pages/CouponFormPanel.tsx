import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { BannerLinkSelect } from "@/components/admin/BannerLinkSelect";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { listAdminBanners } from "@/features/content/api/admin-content.api";
import {
  ApiError,
  createAdminCoupon,
  updateAdminCoupon,
  type CouponListItem
} from "@/features/marketing/api/admin-marketing.api";

type Mode = "create" | "edit";

const toDateInput = (iso: string | null | undefined) => {
  if (!iso) {
    return "";
  }
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const endOfDayUtc = (yyyyMmDd: string) => {
  if (!yyyyMmDd.trim()) {
    return undefined;
  }
  return `${yyyyMmDd.trim()}T23:59:59.999Z`;
};

const startOfDayUtc = (yyyyMmDd: string) => {
  if (!yyyyMmDd.trim()) {
    return undefined;
  }
  return `${yyyyMmDd.trim()}T00:00:00.000Z`;
};

export const CouponFormPanel = ({
  mode,
  coupon,
  onClose,
  onSaved
}: {
  mode: Mode;
  coupon: CouponListItem | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountDollars, setDiscountDollars] = useState("");
  const [minOrderDollars, setMinOrderDollars] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [perCustomerLimit, setPerCustomerLimit] = useState("");
  const [activeFrom, setActiveFrom] = useState("");
  const [activeTo, setActiveTo] = useState("");
  const [linkedBannerId, setLinkedBannerId] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const bannersQ = useQuery({
    queryKey: ["admin-banners-picker"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminBanners(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  useEffect(() => {
    setLocalError(null);
    if (mode === "edit" && coupon) {
      setCode(coupon.code);
      setStatus(coupon.status);
      setDiscountType(coupon.discountType);
      if (coupon.discountType.toUpperCase() === "PERCENTAGE" && coupon.discountValue != null) {
        setDiscountPercent(String(coupon.discountValue));
        setDiscountDollars("");
      } else if (coupon.discountType.toUpperCase() === "FIXED_AMOUNT" && coupon.discountValue != null) {
        setDiscountDollars((coupon.discountValue / 100).toFixed(2));
        setDiscountPercent("");
      } else {
        setDiscountPercent("");
        setDiscountDollars("");
      }
      setMinOrderDollars(
        coupon.minOrderAmountCents != null ? (coupon.minOrderAmountCents / 100).toFixed(2) : ""
      );
      setMaxRedemptions(coupon.maxRedemptions != null ? String(coupon.maxRedemptions) : "");
      setPerCustomerLimit(coupon.perCustomerLimit != null ? String(coupon.perCustomerLimit) : "");
      setActiveFrom(toDateInput(coupon.activeFrom));
      setActiveTo(toDateInput(coupon.activeTo));
      setLinkedBannerId(coupon.bannerId ?? "");
    } else {
      setCode("");
      setStatus("ACTIVE");
      setDiscountType("PERCENTAGE");
      setDiscountPercent("");
      setDiscountDollars("");
      setMinOrderDollars("");
      setMaxRedemptions("");
      setPerCustomerLimit("");
      setActiveFrom("");
      setActiveTo("");
      setLinkedBannerId("");
    }
  }, [mode, coupon]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      setLocalError(null);
      const dt = discountType.toUpperCase();
      let discountValue: number | undefined;
      if (dt === "PERCENTAGE") {
        const p = Number.parseFloat(discountPercent);
        if (!Number.isFinite(p) || p < 0 || p > 100) {
          throw new Error("Percentage must be between 0 and 100.");
        }
        discountValue = Math.round(p);
      } else if (dt === "FIXED_AMOUNT") {
        const d = Number.parseFloat(discountDollars);
        if (!Number.isFinite(d) || d < 0) {
          throw new Error("Fixed amount must be a non-negative number.");
        }
        discountValue = Math.round(d * 100);
      } else {
        discountValue = undefined;
      }

      const minCents =
        minOrderDollars.trim() === ""
          ? undefined
          : Math.round(Number.parseFloat(minOrderDollars) * 100);
      if (minCents != null && (!Number.isFinite(minCents) || minCents < 0)) {
        throw new Error("Minimum order is invalid.");
      }

      const maxR =
        maxRedemptions.trim() === "" ? undefined : Number.parseInt(maxRedemptions, 10);
      if (maxR != null && (!Number.isFinite(maxR) || maxR < 1)) {
        throw new Error("Max redemptions must be at least 1 when set.");
      }

      const perL =
        perCustomerLimit.trim() === "" ? undefined : Number.parseInt(perCustomerLimit, 10);
      if (perL != null && (!Number.isFinite(perL) || perL < 1)) {
        throw new Error("Per-customer limit must be at least 1 when set.");
      }

      const af = startOfDayUtc(activeFrom);
      const at = endOfDayUtc(activeTo);

      if (mode === "create") {
        const c = code.trim().toUpperCase();
        if (c.length < 2) {
          throw new Error("Code must be at least 2 characters.");
        }
        return createAdminCoupon(accessToken, {
          code: c,
          status,
          discountType: dt,
          ...(discountValue != null ? { discountValue } : {}),
          ...(minCents != null ? { minOrderAmountCents: minCents } : {}),
          ...(maxR != null ? { maxRedemptions: maxR } : {}),
          ...(perL != null ? { perCustomerLimit: perL } : {}),
          ...(af ? { activeFrom: af } : {}),
          ...(at ? { activeTo: at } : {}),
          ...(linkedBannerId.trim() ? { bannerId: linkedBannerId.trim() } : {})
        });
      }
      if (!coupon) {
        throw new Error("Missing coupon.");
      }
      return updateAdminCoupon(accessToken, coupon.id, {
        status,
        discountType: dt,
        ...(discountValue != null ? { discountValue } : {}),
        ...(minCents != null ? { minOrderAmountCents: minCents } : {}),
        ...(maxR != null ? { maxRedemptions: maxR } : {}),
        ...(perL != null ? { perCustomerLimit: perL } : {}),
        ...(af ? { activeFrom: af } : {}),
        ...(at ? { activeTo: at } : {}),
        bannerId: linkedBannerId.trim() === "" ? null : linkedBannerId.trim()
      });
    },
    onSuccess: onSaved,
    onError: (e) => {
      setLocalError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed.");
    }
  });

  return (
    <div className="fixed inset-0 z-[55] flex justify-end bg-black/40">
      <button type="button" className="h-full flex-1 cursor-default" aria-label="Close panel" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-headline text-lg font-bold text-[#181b25]">
            {mode === "create" ? "New coupon" : `Edit ${coupon?.code ?? ""}`}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {localError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{localError}</div>
          ) : null}
          {mode === "create" ? (
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase"
                placeholder="SAVE20"
                maxLength={80}
              />
            </label>
          ) : (
            <p className="text-sm text-slate-600">
              Code: <span className="font-mono font-bold text-[#181b25]">{coupon?.code}</span> (cannot be changed)
            </p>
          )}
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Discount type</span>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_AMOUNT">Fixed amount (USD)</option>
              <option value="FREE_SHIPPING">Free shipping</option>
            </select>
          </label>
          {discountType.toUpperCase() === "PERCENTAGE" ? (
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Percent off</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          ) : null}
          {discountType.toUpperCase() === "FIXED_AMOUNT" ? (
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount off (USD)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={discountDollars}
                onChange={(e) => setDiscountDollars(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          ) : null}
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Minimum order (USD)</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={minOrderDollars}
              onChange={(e) => setMinOrderDollars(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Max redemptions (total)</span>
            <input
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Unlimited if empty"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Per-customer limit</span>
            <input
              type="number"
              min={1}
              value={perCustomerLimit}
              onChange={(e) => setPerCustomerLimit(e.target.value)}
              placeholder="Unlimited if empty"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <BannerLinkSelect
            label="Linked banner (optional)"
            value={linkedBannerId}
            onChange={setLinkedBannerId}
            banners={bannersQ.data?.data.items ?? []}
            loading={bannersQ.isLoading}
            hint="Optional promotional asset; banners do not need to be tied to a coupon."
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active from</span>
              <input
                type="date"
                value={activeFrom}
                onChange={(e) => setActiveFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active through</span>
              <input
                type="date"
                value={activeTo}
                onChange={(e) => setActiveTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
            className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3b6de6] disabled:opacity-50"
          >
            {saveMut.isPending ? "Saving…" : mode === "create" ? "Create coupon" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
