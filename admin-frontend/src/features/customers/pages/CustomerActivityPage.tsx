import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { CustomerWorkspaceNav } from "@/components/stitch/CustomerWorkspaceNav";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  getAdminCustomerActivity,
  getAdminCustomerDetail,
  type CustomerActivityItem
} from "@/features/customers/api/admin-customers.api";
import {
  activityKindFilter,
  ActivityEventCard,
  type ActivityFilterChip
} from "@/features/customers/lib/customerActivityPresentation";
import { displayCustomerName } from "@/features/customers/lib/customerDisplay";
import { CustomerWorkspaceHeader } from "@/features/customers/ui/CustomerWorkspaceHeader";

const CHIP_LABELS: { id: ActivityFilterChip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "logins", label: "Logins" },
  { id: "orders", label: "Orders" },
  { id: "support", label: "Support" },
  { id: "reviews", label: "Reviews" },
  { id: "status", label: "Account status" },
  { id: "security", label: "Risk" },
  { id: "notes", label: "Notes" }
];

const matchesChip = (item: CustomerActivityItem, chip: ActivityFilterChip) => {
  if (chip === "all") {
    return true;
  }
  if (chip === "status") {
    return item.kind.toUpperCase() === "STATUS_CHANGE";
  }
  return activityKindFilter(item.kind) === chip;
};

const startOfLocalDay = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) {
    return null;
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
};

const endOfLocalDay = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) {
    return null;
  }
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
};

const inDateRange = (occurredAt: string, rangeFrom: string, rangeTo: string) => {
  const t = new Date(occurredAt).getTime();
  if (Number.isNaN(t)) {
    return true;
  }
  if (rangeFrom.trim()) {
    const start = startOfLocalDay(rangeFrom.trim());
    if (start != null && t < start) {
      return false;
    }
  }
  if (rangeTo.trim()) {
    const end = endOfLocalDay(rangeTo.trim());
    if (end != null && t > end) {
      return false;
    }
  }
  return true;
};

export const CustomerActivityPage = () => {
  const { customerId = "" } = useParams<{ customerId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [chip, setChip] = useState<ActivityFilterChip>("all");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const detailQ = useQuery({
    queryKey: ["admin-customer-detail", customerId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminCustomerDetail(accessToken, customerId);
    },
    enabled: Boolean(accessToken) && Boolean(customerId)
  });

  const q = useQuery({
    queryKey: ["admin-customer-activity", customerId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return getAdminCustomerActivity(accessToken, customerId);
    },
    enabled: Boolean(accessToken) && Boolean(customerId)
  });

  const entity = detailQ.data?.data.entity;
  const customerName = entity ? displayCustomerName(entity) : "Customer";

  const items = q.data?.data.items ?? [];
  const filtered = useMemo(
    () =>
      items.filter(
        (it) => matchesChip(it, chip) && inDateRange(it.occurredAt, rangeFrom, rangeTo)
      ),
    [items, chip, rangeFrom, rangeTo]
  );

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  return (
    <div className="space-y-6">
      {!customerId ? <p className="text-sm text-red-700">Missing customer id.</p> : null}
      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}

      {customerId ? (
        <>
          <CustomerWorkspaceHeader customerId={customerId} customerName={customerName} tabLabel="Activity" />
          <CustomerWorkspaceNav customerId={customerId} />

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#c3c6d6]/30 bg-white px-4 py-3 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Visible range</span>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              From
              <input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="rounded-lg border border-[#c3c6d6]/50 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              To
              <input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="rounded-lg border border-[#c3c6d6]/50 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              className="text-xs font-bold uppercase tracking-wide text-[#1653cc] hover:underline"
              onClick={() => {
                setRangeFrom("");
                setRangeTo("");
              }}
            >
              Clear range
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {CHIP_LABELS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChip(c.id)}
                className={`whitespace-nowrap rounded-full px-5 py-1.5 text-xs font-bold transition-colors ${
                  chip === c.id
                    ? "bg-[#1653cc] text-white shadow-md"
                    : "border border-[#c3c6d6] bg-white text-[#181b25] hover:border-[#1653cc]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {q.isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-[#c3c6d6]/30 bg-white p-8 text-center text-sm text-slate-500">
              No activity in this view.
            </div>
          ) : (
            <div className="relative ml-2 pl-2">
              <div
                className="pointer-events-none absolute bottom-0 left-[19px] top-0 w-px bg-[#c3c6d6]/40"
                aria-hidden
              />
              <div className="space-y-0">
                {filtered.map((item) => (
                  <ActivityEventCard key={item.id} item={item} customerId={customerId} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
