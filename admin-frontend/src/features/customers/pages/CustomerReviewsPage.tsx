import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { CustomerWorkspaceNav } from "@/components/stitch/CustomerWorkspaceNav";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, getAdminCustomerDetail, listAdminCustomerReviews } from "@/features/customers/api/admin-customers.api";
import { displayCustomerName } from "@/features/customers/lib/customerDisplay";
import { CustomerWorkspaceHeader } from "@/features/customers/ui/CustomerWorkspaceHeader";

const tone = (s: string): StatusBadgeTone => (s === "PUBLISHED" ? "active" : s === "REJECTED" ? "danger" : "pending");

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const CustomerReviewsPage = () => {
  const { customerId = "" } = useParams<{ customerId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [page, setPage] = useState(1);

  const queryKey = useMemo(() => ["admin-customer-reviews", customerId, page] as const, [customerId, page]);

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
      return listAdminCustomerReviews(accessToken, customerId, { page, page_size: 20 });
    },
    enabled: Boolean(accessToken) && Boolean(customerId)
  });

  const entity = detailQ.data?.data.entity;
  const customerName = entity ? displayCustomerName(entity) : "Customer";

  const items = listQuery.data?.data.items ?? [];
  const meta = listQuery.data?.meta;

  const err =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error instanceof Error
        ? listQuery.error.message
        : null;

  return (
    <div className="space-y-6">
      {!customerId ? <p className="text-sm text-red-700">Missing customer id.</p> : null}
      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}

      {customerId ? (
        <>
          <CustomerWorkspaceHeader customerId={customerId} customerName={customerName} tabLabel="Reviews" />
          <CustomerWorkspaceNav customerId={customerId} />

          <div className="overflow-hidden rounded-xl border border-[#c3c6d6]/20 bg-white shadow-sm">
            <div className="border-b border-[#c3c6d6]/20 px-6 py-4">
              <h4 className="text-sm font-bold uppercase tracking-widest text-slate-700">Product reviews</h4>
              <p className="mt-1 text-xs text-slate-500">Moderation status and catalog links for each review.</p>
            </div>
            {listQuery.isLoading ? (
              <p className="p-8 text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No reviews.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#ecedfb]/50">
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Rating</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Product</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">SKU</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c3c6d6]/10">
                    {items.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-[#faf8ff]">
                        <td className="px-6 py-4 text-sm font-semibold">{r.rating}★</td>
                        <td className="px-6 py-4">
                          <StatusBadge label={r.status.replace(/_/g, " ")} tone={tone(r.status)} />
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            to={`/admin/catalog/products/${r.product.id}`}
                            className="max-w-[240px] truncate text-sm font-medium text-[#1653cc] hover:underline"
                          >
                            {r.product.title}
                          </Link>
                        </td>
                        <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{r.variant?.sku ?? "—"}</td>
                        <td className="px-6 py-4 text-xs text-slate-600">{formatWhen(r.createdAt)}</td>
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
                  className="rounded-lg border px-3 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border px-3 py-1 disabled:opacity-40"
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
