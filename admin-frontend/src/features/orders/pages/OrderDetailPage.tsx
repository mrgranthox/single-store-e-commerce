import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  CheckCheck,
  ChevronRight,
  History,
  Truck,
  Warehouse as WarehouseIcon,
  XCircle
} from "lucide-react";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  assignAdminOrderWarehouse,
  cancelAdminOrder,
  createAdminOrderShipment,
  getAdminOrderDetail,
  updateAdminOrderStatus,
  type AdminOrderDetailEntity,
  type AdminOrderStatus
} from "@/features/orders/api/admin-orders.api";
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

const ORDER_STATUSES: AdminOrderStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
  "CLOSED"
];

const formatMoney = (cents: number | null | undefined, currency: string | null | undefined) => {
  if (typeof cents !== "number" || Number.isNaN(cents)) {
    return "—";
  }
  const cur = (currency ?? "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
};

const formatWhenUtcLabel = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "UTC"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const humanize = (raw: string | null | undefined) => (raw ?? "—").replace(/_/g, " ");

const customerInitials = (entity: AdminOrderDetailEntity["customer"]) => {
  const base = (entity.name ?? entity.email ?? "Guest").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase() || "—";
};

const HeaderStatusChip = ({ status }: { status: string }) => {
  const u = status.toUpperCase();
  const isTerminalOk = u === "COMPLETED" || u === "CLOSED";
  const isCancelled = u === "CANCELLED";
  const dot = isCancelled ? "bg-[#ba1a1a]" : isTerminalOk ? "bg-[#006b2d]" : "bg-[#006b2d]";
  const text = isCancelled ? "text-[#ba1a1a]" : "text-[#006b2d]";
  return (
    <span
      className={`inline-flex items-center rounded-full border border-[#c3c6d6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ${text}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${dot}`} />
      {humanize(status)}
    </span>
  );
};

const PaymentStateChip = ({ state }: { state: string }) => {
  const u = state.toUpperCase();
  const dot =
    u === "PAID" || u === "CAPTURED" || u === "SUCCEEDED"
      ? "bg-[#006b2d]"
      : u === "FAILED" || u === "CANCELLED"
        ? "bg-[#ba1a1a]"
        : "bg-amber-500";
  const text =
    u === "PAID" || u === "CAPTURED" || u === "SUCCEEDED"
      ? "text-[#006b2d]"
      : u === "FAILED" || u === "CANCELLED"
        ? "text-[#ba1a1a]"
        : "text-amber-800";
  return (
    <span
      className={`inline-flex items-center rounded-full border border-[#c3c6d6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ${text}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${dot}`} />
      {humanize(state)}
    </span>
  );
};

const FulfillmentStateChip = ({ status }: { status: string }) => (
  <span className="inline-flex items-center rounded-full border border-[#c3c6d6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter text-[#5b5e68]">
    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#5b5e68]" />
    {humanize(status)}
  </span>
);

const downloadCsv = (filename: string, rows: string[][]) => {
  const esc = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const body = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const scrollToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

type PendingOrderAction = "status" | "assign" | "ship" | "cancel" | null;

export const OrderDetailPage = () => {
  const { orderId = "" } = useParams<{ orderId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorPermissions = useAdminAuthStore((s) => s.actor?.permissions);
  const queryClient = useQueryClient();

  const [nextStatus, setNextStatus] = useState<AdminOrderStatus>("PROCESSING");
  const [statusReason, setStatusReason] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [shipWarehouseId, setShipWarehouseId] = useState("");
  const [shipCarrier, setShipCarrier] = useState("");
  const [shipTracking, setShipTracking] = useState("");
  const [shipNote, setShipNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<PendingOrderAction>(null);
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [detailQ] = useQueries({
    queries: [
      {
        queryKey: ["admin-order-detail", orderId],
        queryFn: async () => {
          if (!accessToken) {
            throw new Error("Not signed in.");
          }
          return getAdminOrderDetail(accessToken, orderId);
        },
        enabled: Boolean(accessToken) && Boolean(orderId)
      }
    ]
  });

  const entity = detailQ.data?.data.entity;

  const latestShipment = useMemo(() => {
    const s = entity?.shipments ?? [];
    if (s.length === 0) {
      return null;
    }
    return [...s].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
  }, [entity?.shipments]);

  const linesSubtotalCents = useMemo(() => {
    return (entity?.items ?? []).reduce((acc, line) => acc + (line.lineTotalCents ?? 0), 0);
  }, [entity?.items]);

  const grandCents =
    typeof entity?.totals?.grandTotalCents === "number" ? entity.totals.grandTotalCents : linesSubtotalCents;
  const currency = entity?.totals?.currency ?? entity?.payment.currency ?? entity?.items[0]?.unitPriceCurrency;

  const invalidateOrder = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-order-detail", orderId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-order-timeline", orderId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const statusMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return updateAdminOrderStatus(accessToken, orderId, {
        status: nextStatus,
        ...(statusReason.trim() ? { reason: statusReason.trim() } : {}),
        ...(statusNote.trim() ? { note: statusNote.trim() } : {})
      });
    },
    onSuccess: () => {
      setActionMsg({ type: "ok", text: "Order status updated." });
      invalidateOrder();
    },
    onError: (err: unknown) => {
      setActionMsg({
        type: "err",
        text: err instanceof ApiError ? err.message : "Status update failed."
      });
    }
  });

  const assignMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return assignAdminOrderWarehouse(accessToken, orderId, {
        warehouseId: warehouseId.trim(),
        ...(assignNote.trim() ? { note: assignNote.trim() } : {})
      });
    },
    onSuccess: () => {
      setActionMsg({ type: "ok", text: "Warehouse assigned." });
      invalidateOrder();
    },
    onError: (err: unknown) => {
      setActionMsg({
        type: "err",
        text: err instanceof ApiError ? err.message : "Assign warehouse failed."
      });
    }
  });

  const cancelMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return cancelAdminOrder(accessToken, orderId, {
        reason: cancelReason.trim(),
        ...(cancelNote.trim() ? { note: cancelNote.trim() } : {})
      });
    },
    onSuccess: () => {
      setActionMsg({ type: "ok", text: "Cancellation recorded." });
      invalidateOrder();
    },
    onError: (err: unknown) => {
      setActionMsg({
        type: "err",
        text: err instanceof ApiError ? err.message : "Cancel order failed."
      });
    }
  });

  const shipMut = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return createAdminOrderShipment(accessToken, orderId, {
        warehouseId: shipWarehouseId.trim(),
        ...(shipCarrier.trim() ? { carrier: shipCarrier.trim() } : {}),
        ...(shipTracking.trim() ? { trackingNumber: shipTracking.trim() } : {}),
        ...(shipNote.trim() ? { note: shipNote.trim() } : {})
      });
    },
    onSuccess: () => {
      setActionMsg({ type: "ok", text: "Shipment created." });
      invalidateOrder();
    },
    onError: (err: unknown) => {
      setActionMsg({
        type: "err",
        text: err instanceof ApiError ? err.message : "Create shipment failed."
      });
    }
  });

  const itemRows = useMemo(
    () =>
      (entity?.items ?? []).map((line) => [
        <span key={`t-${line.id}`} className="text-[13px] font-bold text-[#181b25]">
          {line.productTitle}
        </span>,
        <span key={`v-${line.id}`} className="font-mono text-xs text-[#60626c]">
          {line.variantId}
        </span>,
        <span key={`q-${line.id}`} className="text-center text-sm font-bold tabular-nums text-[#181b25]">
          {String(line.quantity).padStart(2, "0")}
        </span>,
        <span key={`p-${line.id}`} className="text-right font-mono text-sm tabular-nums text-[#181b25]">
          {formatMoney(line.unitPriceAmountCents, line.unitPriceCurrency)}
        </span>,
        <span key={`l-${line.id}`} className="text-right font-mono text-sm font-bold tabular-nums text-[#181b25]">
          {formatMoney(line.lineTotalCents, line.unitPriceCurrency)}
        </span>
      ]),
    [entity?.items]
  );

  const exportManifest = () => {
    if (!entity) {
      return;
    }
    const rows: string[][] = [
      ["Product", "Variant ID", "Qty", "Unit (cents)", "Line total (cents)", "Currency"],
      ...(entity.items ?? []).map((line) => [
        line.productTitle,
        line.variantId,
        String(line.quantity),
        String(line.unitPriceAmountCents),
        String(line.lineTotalCents),
        line.unitPriceCurrency
      ])
    ];
    downloadCsv(`order-${entity.orderNumber}-manifest.csv`, rows);
  };

  const detailError =
    detailQ.error instanceof ApiError
      ? detailQ.error.message
      : detailQ.error instanceof Error
        ? detailQ.error.message
        : null;

  const paymentMethodLabel = entity?.payment.provider
    ? humanize(entity.payment.provider)
    : "Not specified";

  const canUpdateOrder = adminHasAnyPermission(actorPermissions, ["orders.update"]);
  const canOverrideFulfillment = adminHasAnyPermission(actorPermissions, ["orders.override_fulfillment", "orders.update"]);
  const canCancelOrder = adminHasAnyPermission(actorPermissions, ["orders.cancel"]);

  const railBtn =
    "group relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-[#1653cc] hover:text-white";

  const confirmTitle =
    confirmAction === "status"
      ? `Apply ${humanize(nextStatus).toLowerCase()} status?`
      : confirmAction === "assign"
        ? "Assign this warehouse?"
        : confirmAction === "ship"
          ? "Create this shipment?"
          : confirmAction === "cancel"
            ? "Cancel this order?"
            : "";

  const confirmBody =
    confirmAction === "status"
      ? `This will update the order to ${humanize(nextStatus).toLowerCase()}${statusReason.trim() ? ` with reason "${statusReason.trim()}".` : "."}`
      : confirmAction === "assign"
        ? `This will assign warehouse ${warehouseId.trim()} to the order${assignNote.trim() ? ` with note "${assignNote.trim()}".` : "."}`
        : confirmAction === "ship"
          ? `This will create a shipment from warehouse ${shipWarehouseId.trim()}${shipCarrier.trim() ? ` using ${shipCarrier.trim()}` : ""}${shipTracking.trim() ? ` with tracking ${shipTracking.trim()}` : ""}.`
          : confirmAction === "cancel"
            ? `This will cancel the order${cancelReason.trim() ? ` for reason "${cancelReason.trim()}".` : "."}`
            : undefined;

  const confirmLabel =
    confirmAction === "status"
      ? "Confirm status update"
      : confirmAction === "assign"
        ? "Confirm assignment"
        : confirmAction === "ship"
          ? "Confirm shipment"
          : confirmAction === "cancel"
            ? "Confirm cancellation"
            : "Confirm";

  const confirmDisabled =
    confirmAction === "status"
      ? statusMut.isPending
      : confirmAction === "assign"
        ? assignMut.isPending
        : confirmAction === "ship"
          ? shipMut.isPending
          : confirmAction === "cancel"
            ? cancelMut.isPending
            : false;

  const submitConfirmedAction = () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "status") {
      statusMut.mutate();
      return;
    }
    if (action === "assign") {
      assignMut.mutate();
      return;
    }
    if (action === "ship") {
      shipMut.mutate();
      return;
    }
    if (action === "cancel") {
      cancelMut.mutate();
    }
  };

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        <PageHeader
          title={entity ? `Order ${entity.orderNumber}` : "Order detail"}
          titleSize="deck"
          description="Operational view — manifest, financials, fulfillment context, and allowed mutations."
          autoBreadcrumbs={false}
          actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-order-detail", orderId])]}
        />

        {!orderId ? <p className="text-sm text-red-700">Missing order id in the URL.</p> : null}

        {detailError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {detailError}
            {detailQ.error instanceof ApiError && detailQ.error.statusCode === 403 ? (
              <span className="mt-1 block text-xs">Requires orders.read.</span>
            ) : null}
          </div>
        ) : null}

        {actionMsg ? (
          <div
            className={
              actionMsg.type === "ok"
                ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            }
            role="status"
          >
            {actionMsg.text}
          </div>
        ) : null}

        {detailQ.isLoading ? (
          <div className="rounded-xl border border-[#e0e2f0] bg-white p-12 text-center text-sm text-[#737685]">
            Loading order…
          </div>
        ) : null}

        {entity ? (
          <>
            <div className="mb-2">
              <nav className="mb-2 flex text-[10px] font-semibold uppercase tracking-widest text-[#737685]">
                <Link className="transition-colors hover:text-[#1653cc]" to="/admin/orders">
                  Orders
                </Link>
                <span className="mx-2 text-slate-300">/</span>
                <span className="text-[#181b25]">Detail view</span>
              </nav>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-3">
                    <h2 className="font-headline text-2xl font-bold tracking-tight text-[#181b25]">
                      Order #<span className="font-mono text-xl text-[#1653cc]">{entity.orderNumber}</span>
                    </h2>
                    <HeaderStatusChip status={entity.status} />
                  </div>
                  <p className="text-sm text-slate-500">Placed on {formatWhenUtcLabel(entity.createdAt)} (UTC)</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={exportManifest}
                    className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 transition-colors hover:bg-slate-50"
                  >
                    Export manifest
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-md bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-[#1653cc]/20 transition-transform hover:scale-[0.98]"
                  >
                    Print invoice
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border-l-4 border-[#1653cc] bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Customer information
                </h3>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#ecedfb] text-sm font-bold text-[#1653cc]">
                    {customerInitials(entity.customer)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">
                      {entity.customer.name ?? entity.customer.email ?? (entity.customer.guest ? "Guest" : "—")}
                    </p>
                    <p className="mb-2 text-sm text-slate-500">{entity.customer.email ?? "—"}</p>
                    {entity.customer.id ? (
                      <Link
                        to={`/admin/customers/${entity.customer.id}`}
                        className="group flex items-center text-xs font-bold text-[#1653cc]"
                      >
                        View account profile
                        <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">No linked account</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border-l-4 border-[#006b2d] bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Payment summary
                </h3>
                <div className="space-y-3">
                  <div className="flex items-end justify-between gap-2">
                    <span className="font-mono text-2xl font-bold text-slate-900">
                      {formatMoney(entity.payment.amountCents, entity.payment.currency)}
                    </span>
                    <PaymentStateChip state={entity.payment.paymentState} />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Method</span>
                    <span className="font-medium text-slate-900">{paymentMethodLabel}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Reference</span>
                    <span className="font-mono text-slate-900">
                      {entity.payment.providerPaymentRef ?? "—"}
                    </span>
                  </div>
                  {entity.payment.id ? (
                    <Link
                      to={`/admin/payments/${entity.payment.id}`}
                      className="inline-flex text-xs font-bold text-[#1653cc] hover:underline"
                    >
                      Open payment record
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border-l-4 border-[#5b5e68] bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Fulfillment details
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <WarehouseIcon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                      <span className="truncate font-medium text-slate-900">
                        {entity.assignedWarehouse?.name
                          ? `${entity.assignedWarehouse.name}${entity.assignedWarehouse.code ? ` (${entity.assignedWarehouse.code})` : ""}`
                          : "Unassigned"}
                      </span>
                    </div>
                    <FulfillmentStateChip status={entity.fulfillment.status} />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Shipment</span>
                    {latestShipment ? (
                      <Link
                        to={`/admin/shipments/${latestShipment.id}`}
                        className="font-mono text-slate-900 hover:text-[#1653cc] hover:underline"
                      >
                        {latestShipment.trackingNumber ?? latestShipment.id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="font-mono text-slate-900">—</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Carrier</span>
                    <span className="font-medium text-slate-900">{latestShipment?.carrier ?? "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#e0e2f0]/40 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e2f0]/40 px-6 py-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Line items ({entity.items?.length ?? 0})
                </h3>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Variant identifiers are system references
                </span>
              </div>
              <DataTableShell
                embedded
                variant="stitchOperational"
                columns={["Product", "Identifier", "Qty", "Unit price", "Total"]}
                rows={itemRows}
                rowKeys={(entity.items ?? []).map((line) => line.id)}
                emptyState="No lines on this order."
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Internal operational notes
                  </h3>
                  <textarea
                    className="h-32 w-full resize-none rounded-lg border-none bg-[#f0f2f7] p-4 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-[#1653cc]/20"
                    placeholder="Add a note for the warehouse team…"
                    readOnly
                    aria-readonly="true"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] italic text-slate-400">
                      Notes are visible only to enterprise staff members. Posting from this screen is not enabled yet —
                      use order actions and audit trails.
                    </p>
                    <button
                      type="button"
                      disabled
                      className="cursor-not-allowed rounded bg-slate-300 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white"
                      title="Not available — use existing workflows that write to the audit trail."
                    >
                      Post note
                    </button>
                  </div>
                </div>

                <Link
                  to={`/admin/orders/${orderId}/timeline`}
                  className="group flex cursor-pointer items-center justify-between rounded-lg bg-[#f2f3ff] p-4 transition-colors hover:bg-[#e6e7f6]"
                >
                  <div className="flex items-center gap-3">
                    <History className="h-5 w-5 text-[#1653cc]" aria-hidden />
                    <span className="text-sm font-bold uppercase tracking-tighter text-slate-900">
                      View full transaction audit timeline
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              <div className="flex flex-col justify-between rounded-xl bg-[#0f1117] p-8 text-white shadow-sm">
                <div>
                  <h3 className="mb-6 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Financial reconciliation
                  </h3>
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Subtotal (lines)</span>
                      <span className="font-mono">{formatMoney(linesSubtotalCents, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Logistics &amp; shipping</span>
                      <span className="font-mono">—</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Estimated VAT / tax</span>
                      <span className="font-mono">—</span>
                    </div>
                    <div className="flex justify-between text-sm italic text-red-300/90">
                      <span>Discounts</span>
                      <span className="font-mono not-italic">—</span>
                    </div>
                  </div>
                </div>
                <div className="mt-8 border-t border-white/10 pt-6">
                  <div className="flex items-end justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      Grand total
                    </span>
                    <span className="font-mono text-3xl font-bold text-[#dbe1ff]">
                      {formatMoney(grandCents, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <SurfaceCard
              title="Admin operations"
              description="Actions depend on your role. Invalid transitions are rejected and audited server-side."
            >
              <div className="grid gap-8 lg:grid-cols-2">
                <div id="order-admin-status" className="scroll-mt-28 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Order status</h3>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    New status
                    <select
                      value={nextStatus}
                      onChange={(ev) => setNextStatus(ev.target.value as AdminOrderStatus)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    Reason (optional)
                    <input
                      value={statusReason}
                      onChange={(ev) => setStatusReason(ev.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="e.g. Customer requested expedite"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    Internal note (optional)
                    <textarea
                      value={statusNote}
                      onChange={(ev) => setStatusNote(ev.target.value)}
                      rows={2}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={statusMut.isPending || !canUpdateOrder}
                    onClick={() => setConfirmAction("status")}
                    className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    title={canUpdateOrder ? undefined : "Requires orders.update permission"}
                  >
                    {statusMut.isPending ? "Updating…" : "Apply status"}
                  </button>
                </div>

                <div id="order-admin-assign" className="scroll-mt-28 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Assign warehouse</h3>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    Warehouse ID
                    <input
                      value={warehouseId}
                      onChange={(ev) => setWarehouseId(ev.target.value)}
                      className="font-mono rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Paste warehouse ID from inventory"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    Note (optional)
                    <input
                      value={assignNote}
                      onChange={(ev) => setAssignNote(ev.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={assignMut.isPending || !warehouseId.trim() || !canOverrideFulfillment}
                    onClick={() => setConfirmAction("assign")}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                    title={canOverrideFulfillment ? undefined : "Requires orders.override_fulfillment permission"}
                  >
                    {assignMut.isPending ? "Assigning…" : "Assign warehouse"}
                  </button>
                </div>

                <div id="order-admin-ship" className="scroll-mt-28 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Create shipment</h3>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    Warehouse ID
                    <input
                      value={shipWarehouseId}
                      onChange={(ev) => setShipWarehouseId(ev.target.value)}
                      className="font-mono rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Fulfillment warehouse for this shipment"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    Carrier (optional)
                    <input
                      value={shipCarrier}
                      onChange={(ev) => setShipCarrier(ev.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    Tracking # (optional)
                    <input
                      value={shipTracking}
                      onChange={(ev) => setShipTracking(ev.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    Note (optional)
                    <input
                      value={shipNote}
                      onChange={(ev) => setShipNote(ev.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={shipMut.isPending || !shipWarehouseId.trim() || !canOverrideFulfillment}
                    onClick={() => setConfirmAction("ship")}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                    title={canOverrideFulfillment ? undefined : "Requires orders.override_fulfillment permission"}
                  >
                    {shipMut.isPending ? "Creating…" : "Create shipment"}
                  </button>
                </div>

                <div id="order-admin-cancel" className="scroll-mt-28 space-y-3 border-t border-slate-100 pt-6 lg:border-t-0 lg:pt-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700">Cancel order</h3>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    Reason (required)
                    <input
                      value={cancelReason}
                      onChange={(ev) => setCancelReason(ev.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Required for audit"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    Note (optional)
                    <textarea
                      value={cancelNote}
                      onChange={(ev) => setCancelNote(ev.target.value)}
                      rows={2}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={cancelMut.isPending || !cancelReason.trim() || !canCancelOrder}
                    onClick={() => setConfirmAction("cancel")}
                    className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    title={canCancelOrder ? undefined : "Requires orders.cancel permission"}
                  >
                    {cancelMut.isPending ? "Cancelling…" : "Cancel order"}
                  </button>
                </div>
              </div>
            </SurfaceCard>
          </>
        ) : null}
      </div>

      {entity ? (
        <aside
          className="sticky top-24 hidden h-fit shrink-0 flex-col items-center gap-4 self-start rounded-lg border border-white/5 bg-[#13161e] py-6 xl:flex"
          aria-label="Quick actions"
        >
          <button
            type="button"
            className={railBtn}
            disabled={!canUpdateOrder}
            title="Mark fulfilled"
            onClick={() => {
              setNextStatus("COMPLETED");
              scrollToSection("order-admin-status");
            }}
          >
            <CheckCheck className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={railBtn}
            disabled={!canOverrideFulfillment}
            title="Assign warehouse"
            onClick={() => scrollToSection("order-admin-assign")}
          >
            <WarehouseIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={railBtn}
            disabled={!canOverrideFulfillment}
            title="Create shipment"
            onClick={() => scrollToSection("order-admin-ship")}
          >
            <Truck className="h-5 w-5" />
          </button>
          <Link
            to={`/admin/orders/${orderId}/timeline`}
            className={railBtn}
            title="View timeline"
          >
            <History className="h-5 w-5" />
          </Link>
          <div className="mt-2 flex flex-col items-center gap-4 border-t border-white/5 pt-6">
            <button
              type="button"
              className="group relative flex h-10 w-10 items-center justify-center rounded-lg text-red-400 transition-all hover:bg-red-500/20"
              disabled={!canCancelOrder}
              title="Cancel order"
              onClick={() => scrollToSection("order-admin-cancel")}
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </aside>
      ) : null}
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmTitle}
        body={confirmBody}
        confirmLabel={confirmLabel}
        danger={confirmAction === "cancel"}
        confirmDisabled={confirmDisabled}
        onClose={() => setConfirmAction(null)}
        onConfirm={submitConfirmedAction}
      />
    </div>
  );
};
