import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { CustomerWorkspaceNav } from "@/components/stitch/CustomerWorkspaceNav";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, getAdminCustomerDetail, listAdminCustomerOrders } from "@/features/customers/api/admin-customers.api";
import { displayCustomerName, formatMinorCurrency } from "@/features/customers/lib/customerDisplay";
import { CustomerWorkspaceHeader } from "@/features/customers/ui/CustomerWorkspaceHeader";

const statusTone = (status: string): StatusBadgeTone => {
  switch (status) {
    case "COMPLETED":
    case "CLOSED":
      return "active";
    case "CONFIRMED":
    case "PROCESSING":
      return "info";
    case "PENDING_PAYMENT":
      return "pending";
    case "CANCELLED":
      return "danger";
    default:
      return "draft";
  }
};

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const CustomerOrdersPage = () => {
  const { customerId = "" } = useParams<{ customerId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [page, setPage] = useState(1);

  const queryKey = useMemo(() => ["admin-customer-orders", customerId, page] as const, [customerId, page]);

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

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminCustomerOrders(accessToken, customerId, { page, page_size: 20 });
    },
    enabled: Boolean(accessToken) && Boolean(customerId)
  });

  const entity = detailQ.data?.data.entity;
  const customerName = entity ? displayCustomerName(entity) : "Customer";

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;

  const errorMessage =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error instanceof Error
        ? listQuery.error.message
        : null;

  return (
    <div className="space-y-6">
      {!customerId ? <p className="text-sm text-red-700">Missing customer id.</p> : null}
      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      {customerId ? (
        <>
          <CustomerWorkspaceHeader customerId={customerId} customerName={customerName} tabLabel="Orders" />
          <CustomerWorkspaceNav customerId={customerId} />

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border-l-4 border-[#1653cc] bg-white p-5 shadow-sm">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Orders in view</p>
              <p className="font-headline text-2xl font-bold">{meta?.totalItems ?? items.length}</p>
              <p className="mt-1 text-[10px] text-slate-400">Paginated list</p>
            </div>
            <div className="rounded-xl border-l-4 border-[#3b6de6] bg-white p-5 shadow-sm">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">This page</p>
              <p className="font-headline text-2xl font-bold">{items.length}</p>
            </div>
            <div className="rounded-xl border-l-4 border-[#00873b] bg-white p-5 shadow-sm">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Lifetime (profile)</p>
              <p className="font-headline text-2xl font-bold">{entity?.counts.orders ?? "—"}</p>
            </div>
            <div className="rounded-xl border-l-4 border-slate-300 bg-white p-5 shadow-sm">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Page</p>
              <p className="font-headline text-2xl font-bold">
                {meta ? `${meta.page} / ${meta.totalPages}` : "—"}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#c3c6d6]/20 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c3c6d6]/20 px-6 py-4">
              <h4 className="text-sm font-bold uppercase tracking-widest text-slate-700">Order history</h4>
              <span className="text-xs text-slate-500">Newest first</span>
            </div>
            {listQuery.isLoading ? (
              <p className="p-8 text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No orders for this customer.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#ecedfb]/50">
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Order</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Placed</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Items</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Summary</th>
                      <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Total
                      </th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Payment</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Fulfillment
                      </th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                      <th className="px-6 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Open
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c3c6d6]/10">
                    {items.map((o) => (
                      <tr key={o.id} className="transition-colors hover:bg-[#faf8ff]">
                        <td className="px-6 py-4">
                          <Link
                            to={`/admin/orders/${o.id}`}
                            className="font-mono text-sm font-semibold text-[#1653cc] hover:underline"
                          >
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-[#181b25]">{formatWhen(o.createdAt)}</td>
                        <td className="px-6 py-4 text-sm font-medium">{o.itemCount}</td>
                        <td className="max-w-[240px] px-6 py-4 text-xs text-slate-600">
                          <span className="line-clamp-2">{o.lineSummary}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-sm font-semibold">
                          {formatMinorCurrency(o.totalAmountCents, o.currency)}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-700">{o.paymentSummary}</td>
                        <td className="px-6 py-4 text-xs text-slate-600">{o.fulfillmentSummary}</td>
                        <td className="px-6 py-4">
                          <StatusBadge label={o.status.replace(/_/g, " ")} tone={statusTone(o.status)} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Link
                            to={`/admin/orders/${o.id}`}
                            className="text-xs font-bold uppercase tracking-wide text-[#1653cc] hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {meta && meta.totalPages > 1 ? (
            <div className="flex flex-wrap justify-between gap-3 text-sm text-[var(--color-text-muted)]">
              <span>
                Page {meta.page} of {meta.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-[var(--color-border-light)] px-3 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-[var(--color-border-light)] px-3 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
