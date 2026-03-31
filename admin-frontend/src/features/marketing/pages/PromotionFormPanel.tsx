import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { BannerLinkSelect } from "@/components/admin/BannerLinkSelect";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { listAdminBanners } from "@/features/content/api/admin-content.api";
import {
  ApiError,
  createAdminPromotion,
  updateAdminPromotion,
  type PromotionListItem
} from "@/features/marketing/api/admin-marketing.api";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

type Mode = "create" | "edit" | "view";

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

const startOfDayUtc = (yyyyMmDd: string) =>
  yyyyMmDd.trim() ? `${yyyyMmDd.trim()}T00:00:00.000Z` : undefined;
const endOfDayUtc = (yyyyMmDd: string) =>
  yyyyMmDd.trim() ? `${yyyyMmDd.trim()}T23:59:59.999Z` : undefined;

export const PromotionFormPanel = ({
  mode,
  promotion,
  onClose,
  onSwitchToEdit,
  onSaved
}: {
  mode: Mode;
  promotion: PromotionListItem | null;
  onClose: () => void;
  onSwitchToEdit?: () => void;
  onSaved: () => void;
}) => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("ACTIVE");
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
    if (promotion && (mode === "edit" || mode === "view")) {
      setName(promotion.name);
      setStatus(promotion.status);
      setActiveFrom(toDateInput(promotion.activeFrom));
      setActiveTo(toDateInput(promotion.activeTo));
      setLinkedBannerId(promotion.bannerId ?? "");
    } else {
      setName("");
      setStatus("ACTIVE");
      setActiveFrom("");
      setActiveTo("");
      setLinkedBannerId("");
    }
  }, [promotion, mode]);

  const readOnly = mode === "view";

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      setLocalError(null);
      const n = name.trim();
      if (n.length < 1) {
        throw new Error("Name is required.");
      }
      const af = startOfDayUtc(activeFrom);
      const at = endOfDayUtc(activeTo);
      if (mode === "create") {
        return createAdminPromotion(accessToken, {
          name: n,
          status,
          ...(af ? { activeFrom: af } : {}),
          ...(at ? { activeTo: at } : {}),
          rules: [],
          ...(linkedBannerId.trim() ? { bannerId: linkedBannerId.trim() } : {})
        });
      }
      if (!promotion) {
        throw new Error("Missing promotion.");
      }
      return updateAdminPromotion(accessToken, promotion.id, {
        name: n,
        status,
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
      <div className="flex h-full w-full max-w-md flex-col border-l border-[#c3c6d6]/25 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-8 w-1 rounded-full bg-[#1653cc]" />
            <h2 className="font-headline text-lg font-bold text-[#181b25]">
              {mode === "create" ? "New promotion" : mode === "edit" ? "Edit promotion" : "Promotion detail"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-[#f8f9fb]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {localError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{localError}</div>
          ) : null}
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2 text-sm text-[#181b25] focus:border-[#1653cc] focus:outline-none focus:ring-1 focus:ring-[#1653cc]"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2 text-sm"
            >
              <option value="ACTIVE">Active (live)</option>
              <option value="DISABLED">Disabled (unpublished)</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          {!readOnly ? (
            <BannerLinkSelect
              label="Linked banner (optional)"
              value={linkedBannerId}
              onChange={setLinkedBannerId}
              banners={bannersQ.data?.data.items ?? []}
              loading={bannersQ.isLoading}
              hint="Optional hero or strip tied to this promotion for merchandising UIs."
            />
          ) : promotion?.linkedBanner ? (
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2 text-xs text-[#434654]">
              Linked banner:{" "}
              <span className="font-mono font-semibold text-[#181b25]">{promotion.linkedBanner.id}</span>
              {promotion.linkedBanner.title ? ` — ${promotion.linkedBanner.title}` : null}
            </div>
          ) : (
            <p className="text-xs text-[#737685]">No linked banner.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Active from</span>
              <input
                type="date"
                value={activeFrom}
                onChange={(e) => setActiveFrom(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-2 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Active through</span>
              <input
                type="date"
                value={activeTo}
                onChange={(e) => setActiveTo(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-2 py-2 text-sm"
              />
            </label>
          </div>
          <p className="rounded-lg border border-[#1653cc]/15 bg-[#f2f3ff] px-3 py-2 text-xs text-[#434654]">
            Targeting rules are managed on the promotion rules screen. Use <strong>Active</strong> for published
            eligibility, <strong>Disabled</strong> to pause, <strong>Archived</strong> to retire from default lists.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
          {readOnly ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#434654]"
              >
                Close
              </button>
              {promotion && onSwitchToEdit ? (
                <button
                  type="button"
                  onClick={onSwitchToEdit}
                  className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3b6de6]"
                >
                  Edit
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#434654]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveMut.isPending}
                onClick={() => saveMut.mutate()}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#1653cc]/20 disabled:opacity-50"
              >
                <MaterialIcon name="save" className="text-base text-white" />
                {saveMut.isPending ? "Saving…" : mode === "create" ? "Create promotion" : "Save changes"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
