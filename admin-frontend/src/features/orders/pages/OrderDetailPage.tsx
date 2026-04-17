import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { timelinePayloadLine } from "@/features/security/lib/securityUiHelpers";
import {
  ApiError,
  assignAdminOrderWarehouse,
  cancelAdminOrder,
  createAdminOrderShipment,
  getAdminOrderDetail,
  patchAdminOrderCampaignAttribution,
  updateAdminOrderStatus,
  type AdminOrderDetailEntity,
  type AdminOrderStatus
} from "@/features/orders/api/admin-orders.api";
import { getEntityTimeline } from "@/features/security/api/admin-audit.api";
import { useAdminAction } from "@/lib/admin-actions/useAdminAction";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";
import { adminHasAnyPermission } from "@/lib/admin-rbac/permissions";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { orderKeys } from "@/lib/query-keys";
import { formatDateTime, formatMoney, humanize, initials } from "@/lib/format";

const ORDER_STATUSES: AdminOrderStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
  "CLOSED"
];

const orderStatusTone = (status: string): StatusBadgeTone => {
  const u = status.toUpperCase();
  if (u === "COMPLETED" || u === "CLOSED") return "success";
  if (u === "CANCELLED") return "danger";
  if (u === "CONFIRMED" || u === "PROCESSING") return "info";
  return "draft";
};

const paymentStateTone = (state: string): StatusBadgeTone => {
  const u = state.toUpperCase();
  if (u === "PAID" || u === "CAPTURED" || u === "SUCCEEDED") return "active";
  if (u === "FAILED" || u === "CANCELLED") return "danger";
  if (u.includes("REFUND")) return "neutral";
  return "pending";
};

const fulfillmentStateTone = (status: string): StatusBadgeTone => {
  const u = status.toUpperCase();
  if (u === "DELIVERED") return "active";
  if (u === "IN_TRANSIT" || u === "DISPATCHED") return "info";
  if (u === "UNFULFILLED") return "pending";
  return "draft";
};

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
  const [campaignId, setCampaignId] = useState("");
  const [campaignNote, setCampaignNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<PendingOrderAction>(null);

  const detailQ = useAuthedQuery(
    orderKeys.detail(orderId),
    (token) => getAdminOrderDetail(token, orderId),
    { enabled: Boolean(orderId) },
  );

  const entity = detailQ.data?.data.entity;
  const entityTimelineQ = useAuthedQuery(
    orderKeys.timeline(orderId),
    (token) => getEntityTimeline(token, "order", orderId, { page: 1, page_size: 6 }),
    { enabled: Boolean(orderId) },
  );

  const latestShipment = useMemo(() => {
    const s = entity?.shipments ?? [];
    if (s.length === 0) {
      return null;
    }
    return [...s].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
  }, [entity?.shipments]);

  const shippingSnapshotRows = useMemo(() => {
    if (!entity?.addressSnapshot) {
      return [] as { label: string; value: string }[];
    }
    const s = entity.addressSnapshot;
    const rows: { label: string; value: string }[] = [];
    const push = (label: string, v: string | null | undefined) => {
      const t = v?.trim();
      if (t) {
        rows.push({ label, value: t });
      }
    };
    push("Full name", s.fullName);
    push("Email", s.email);
    push("Phone", s.phone);
    push("Country", s.country);
    push("Region / state", s.region);
    push("City", s.city);
    push("Address line 1", s.line1);
    push("Address line 2", s.line2);
    push("Postal code", s.postalCode);
    if (s.shippingMethodCode?.trim()) {
      rows.push({ label: "Shipping method", value: humanize(s.shippingMethodCode) });
    }
    return rows;
  }, [entity?.addressSnapshot]);

  const linesSubtotalCents = useMemo(() => {
    return (entity?.items ?? []).reduce((acc, line) => acc + (line.lineTotalCents ?? 0), 0);
  }, [entity?.items]);

  const grandCents =
    typeof entity?.totals?.grandTotalCents === "number" ? entity.totals.grandTotalCents : linesSubtotalCents;
  const currency = entity?.totals?.currency ?? entity?.payment.currency ?? entity?.items[0]?.unitPriceCurrency;

  const checkoutShippingCents =
    typeof entity?.totals?.shippingCents === "number" ? entity.totals.shippingCents : null;
  const checkoutTaxCents = typeof entity?.totals?.taxCents === "number" ? entity.totals.taxCents : null;
  const checkoutDiscountCents =
    typeof entity?.totals?.discountCents === "number" ? entity.totals.discountCents : null;

  const appliedCheckoutCoupon = useMemo(() => {
    const raw = entity?.couponOutcome;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }
    const o = raw as Record<string, unknown>;
    if (o.valid !== true) {
      return null;
    }
    const code = typeof o.appliedCode === "string" ? o.appliedCode.trim() : "";
    if (!code) {
      return null;
    }
    if (typeof o.discountCents !== "number" || !Number.isFinite(o.discountCents)) {
      return null;
    }
    return { appliedCode: code, discountCents: Math.trunc(o.discountCents) };
  }, [entity?.couponOutcome]);

  const orderInvalidateKeys = [orderKeys.detail(orderId), orderKeys.timeline(orderId), orderKeys.all()];
  const canUpdateOrder = adminHasAnyPermission(actorPermissions, ["orders.update"]);
  const canOverrideFulfillment = adminHasAnyPermission(actorPermissions, ["orders.override_fulfillment", "orders.update"]);
  const canCancelOrder = adminHasAnyPermission(actorPermissions, ["orders.cancel"]);
  const canViewAudit = adminHasAnyPermission(actorPermissions, ["security.audit.read"]);
  const normalizedWarehouseId = warehouseId.trim();
  const normalizedShipWarehouseId = shipWarehouseId.trim();
  const normalizedCampaignId = campaignId.trim();
  const normalizedCampaignNote = campaignNote.trim();
  const normalizedCancelReason = cancelReason.trim();
  const shipmentCreatable = Boolean(normalizedShipWarehouseId);
  const campaignHasChanges = Boolean(
    entity && (normalizedCampaignId !== (entity.campaignId ?? "") || normalizedCampaignNote)
  );

  useEffect(() => {
    if (!entity) {
      return;
    }
    setCampaignId(entity.campaignId ?? "");
  }, [entity?.campaignId, entity?.id]);

  const orderDetailKey = orderKeys.detail(orderId);

  const statusMut = useAdminAction({
    mutationFn: () =>
      updateAdminOrderStatus(accessToken!, orderId, {
        status: nextStatus,
        ...(statusReason.trim() ? { reason: statusReason.trim() } : {}),
        ...(statusNote.trim() ? { note: statusNote.trim() } : {}) }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: orderDetailKey });
      const snapshot = queryClient.getQueryData(orderDetailKey);
      queryClient.setQueryData(orderDetailKey, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const prev = old as { data?: { entity?: { status?: string } } };
        if (!prev.data?.entity) return old;
        return { ...prev, data: { ...prev.data, entity: { ...prev.data.entity, status: nextStatus } } };
      });
      return snapshot;
    },
    onError: (_err: unknown, _vars: unknown, context: unknown) => {
      if (context !== undefined) queryClient.setQueryData(orderDetailKey, context);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: orderDetailKey });
    },
    successMessage: "Order status updated.",
    errorMessage: (err) =>
      err instanceof ApiError ? err.message : "Status update failed.",
    isAllowed: canUpdateOrder,
    invalidate: [],
  });

  const assignMut = useAdminAction({
    mutationFn: () =>
      assignAdminOrderWarehouse(accessToken!, orderId, {
        warehouseId: normalizedWarehouseId,
        ...(assignNote.trim() ? { note: assignNote.trim() } : {}) }),
    successMessage: "Warehouse assigned.",
    errorMessage: (err) =>
      err instanceof ApiError ? err.message : "Assign warehouse failed.",
    isAllowed: canOverrideFulfillment,
    isAvailable: Boolean(normalizedWarehouseId),
    invalidate: orderInvalidateKeys });

  const cancelMut = useAdminAction({
    mutationFn: () =>
      cancelAdminOrder(accessToken!, orderId, {
        reason: normalizedCancelReason,
        ...(cancelNote.trim() ? { note: cancelNote.trim() } : {}) }),
    successMessage: "Cancellation recorded.",
    errorMessage: (err) =>
      err instanceof ApiError ? err.message : "Cancel order failed.",
    isAllowed: canCancelOrder,
    isAvailable: Boolean(normalizedCancelReason),
    invalidate: orderInvalidateKeys });

  const shipMut = useAdminAction({
    mutationFn: () =>
      createAdminOrderShipment(accessToken!, orderId, {
        warehouseId: normalizedShipWarehouseId,
        ...(shipCarrier.trim() ? { carrier: shipCarrier.trim() } : {}),
        ...(shipTracking.trim() ? { trackingNumber: shipTracking.trim() } : {}),
        ...(shipNote.trim() ? { note: shipNote.trim() } : {}) }),
    successMessage: "Shipment created.",
    errorMessage: (err) =>
      err instanceof ApiError ? err.message : "Create shipment failed.",
    isAllowed: canOverrideFulfillment,
    isAvailable: shipmentCreatable,
    invalidate: orderInvalidateKeys });

  const campaignMut = useAdminAction({
    mutationFn: () =>
      patchAdminOrderCampaignAttribution(accessToken!, orderId, {
        campaignId: normalizedCampaignId || null,
        ...(normalizedCampaignNote ? { note: normalizedCampaignNote } : {}) }),
    successMessage: "Campaign attribution updated.",
    errorMessage: (err) =>
      err instanceof ApiError ? err.message : "Campaign attribution update failed.",
    isAllowed: canUpdateOrder,
    isAvailable: campaignHasChanges,
    invalidate: orderInvalidateKeys });

  const itemRows = useMemo(
    () =>
      (entity?.items ?? []).map((line) => [
        <span key={`t-${line.id}`} className="block min-w-0 break-words text-[13px] font-bold text-[#181b25]">
          {line.productTitle}
        </span>,
        <span key={`v-${line.id}`} className="block min-w-0 break-all font-mono text-xs text-[#60626c]">
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
      ? statusMut.isPending || statusMut.blocked
      : confirmAction === "assign"
        ? assignMut.isPending || assignMut.blocked
        : confirmAction === "ship"
          ? shipMut.isPending || shipMut.blocked
          : confirmAction === "cancel"
            ? cancelMut.isPending || cancelMut.blocked
            : false;

  const submitConfirmedAction = () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "status") {
      statusMut.run(undefined);
      return;
    }
    if (action === "assign") {
      assignMut.run(undefined);
      return;
    }
    if (action === "ship") {
      shipMut.run(undefined);
      return;
    }
    if (action === "cancel") {
      cancelMut.run(undefined);
    }
  };

  return (
    <div className="flex min-w-0 gap-4 md:gap-6">
      <div className="min-w-0 flex-1 space-y-4 sm:space-y-6">
        <PageHeader
          title={entity ? `Order ${entity.orderNumber}` : "Order detail"}
          titleSize="deck"
          description="Operational view — manifest, financials, fulfillment context, and allowed mutations."
          autoBreadcrumbs={false}
          actionMenuItems={[refreshDataMenuItem(queryClient, orderKeys.detail(orderId))]}
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

        {detailQ.isLoading ? (
          <div className="rounded-xl border border-[#e0e2f0] bg-white p-12 text-center text-sm text-[#737685]">
            Loading order…
          </div>
        ) : null}

        {entity ? (
          <>
            <div className="mb-2">
              <nav className="mb-2 flex text-xs font-semibold uppercase tracking-widest text-[#737685]">
                <Link className="transition-colors hover:text-[#1653cc]" to="/admin/orders">
                  Orders
                </Link>
                <span className="mx-2 text-slate-300">/</span>
                <span className="text-[#181b25]">Detail view</span>
              </nav>
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2 sm:gap-3">
                    <h2 className="font-headline text-xl font-bold tracking-tight text-[#181b25] sm:text-2xl">
                      Order #<span className="font-mono text-lg text-[#1653cc] sm:text-xl">{entity.orderNumber}</span>
                    </h2>
                    <StatusBadge
                      className="shrink-0"
                      label={humanize(entity.status)}
                      tone={orderStatusTone(entity.status)}
                    />
                  </div>
                  <p className="text-sm text-slate-500">Placed on {formatDateTime(entity.createdAt)} (UTC)</p>
                </div>
                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={exportManifest}
                    className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 transition-colors hover:bg-slate-50 sm:min-h-[44px]"
                  >
                    Export manifest
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-md bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-[#1653cc]/20 transition-transform hover:scale-[0.98] sm:min-h-[44px]"
                  >
                    Print invoice
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border-l-4 border-[#1653cc] bg-white p-4 shadow-sm sm:p-6">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Customer information
                </h3>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#ecedfb] text-sm font-bold text-[#1653cc]">
                    {initials(entity.customer.name ?? entity.customer.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-bold text-slate-900">
                      {entity.customer.name ?? entity.customer.email ?? (entity.customer.guest ? "Guest" : "—")}
                    </p>
                    <p className="mb-2 break-words text-sm text-slate-500">{entity.customer.email ?? "—"}</p>
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

              <div className="rounded-xl border-l-4 border-[#006b2d] bg-white p-4 shadow-sm sm:p-6">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Payment summary
                </h3>
                <div className="space-y-3">
                  <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
                    <span className="min-w-0 shrink font-mono text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">
                      {formatMoney(entity.payment.amountCents, entity.payment.currency)}
                    </span>
                    <StatusBadge
                      className="shrink-0"
                      label={humanize(entity.payment.paymentState)}
                      tone={paymentStateTone(entity.payment.paymentState)}
                    />
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="shrink-0 text-slate-500">Method</span>
                    <span className="min-w-0 break-words text-right font-medium text-slate-900">{paymentMethodLabel}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="shrink-0 text-slate-500">Reference</span>
                    <span className="min-w-0 break-all text-right font-mono text-slate-900">
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

              <div className="rounded-xl border-l-4 border-[#5b5e68] bg-white p-4 shadow-sm sm:p-6 md:col-span-2 lg:col-span-1">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Fulfillment details
                </h3>
                <div className="space-y-3">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <WarehouseIcon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                      <span className="truncate font-medium text-slate-900">
                        {entity.assignedWarehouse?.name
                          ? `${entity.assignedWarehouse.name}${entity.assignedWarehouse.code ? ` (${entity.assignedWarehouse.code})` : ""}`
                          : "Unassigned"}
                      </span>
                    </div>
                    <StatusBadge
                      className="shrink-0"
                      label={humanize(entity.fulfillment.status)}
                      tone={fulfillmentStateTone(entity.fulfillment.status)}
                    />
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="shrink-0 text-slate-500">Shipment</span>
                    {latestShipment ? (
                      <Link
                        to={`/admin/shipments/${latestShipment.id}`}
                        className="min-w-0 break-all text-right font-mono text-slate-900 hover:text-[#1653cc] hover:underline"
                      >
                        {latestShipment.trackingNumber ?? latestShipment.id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="font-mono text-slate-900">—</span>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="shrink-0 text-slate-500">Carrier</span>
                    <span className="min-w-0 break-words text-right font-medium text-slate-900">
                      {latestShipment?.carrier ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {shippingSnapshotRows.length > 0 ? (
              <div className="rounded-xl border-l-4 border-[#1653cc] bg-white p-4 shadow-sm sm:p-6">
                <h3 className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  <Truck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  Shipping address & checkout
                </h3>
                <div className="space-y-3">
                  {shippingSnapshotRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex flex-col gap-0.5 text-sm sm:flex-row sm:flex-wrap sm:justify-between sm:gap-x-4 sm:gap-y-1"
                    >
                      <span className="shrink-0 text-slate-500">{row.label}</span>
                      <span className="min-w-0 break-words font-medium text-slate-900 sm:max-w-xl sm:text-right">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-[#e0e2f0]/40 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-[#e0e2f0]/40 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-2 sm:px-6 sm:py-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Line items ({entity.items?.length ?? 0})
                </h3>
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 sm:max-w-[55%] sm:text-right lg:max-w-none">
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

            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
              <div className="space-y-4 sm:space-y-6 lg:col-span-2">
                <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Internal operational notes
                  </h3>
                  <textarea
                    className="h-32 w-full resize-none rounded-lg border-none bg-[#f0f2f7] p-4 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-[#1653cc]/20"
                    placeholder="Add a note for the warehouse team…"
                    readOnly
                    aria-readonly="true"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs italic text-slate-400">
                      Notes are visible only to enterprise staff members. Posting from this screen is not enabled yet —
                      use order actions and audit trails.
                    </p>
                    <button
                      type="button"
                      disabled
                      className="cursor-not-allowed rounded bg-slate-300 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white"
                      title="Not available — use existing workflows that write to the audit trail."
                    >
                      Post note
                    </button>
                  </div>
                </div>

                {canViewAudit ? (
                  <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                        Entity timeline preview
                      </h3>
                      <Link
                        to={`/admin/orders/${orderId}/timeline`}
                        className="shrink-0 text-xs font-bold uppercase tracking-wider text-[#1653cc] hover:underline"
                      >
                        Full timeline
                      </Link>
                    </div>
                    {entityTimelineQ.isLoading ? (
                      <p className="text-sm text-slate-500">Loading audit events…</p>
                    ) : entityTimelineQ.isError ? (
                      <p className="text-sm text-amber-800">
                        {entityTimelineQ.error instanceof ApiError ? entityTimelineQ.error.message : "Timeline unavailable."}
                      </p>
                    ) : (entityTimelineQ.data?.data.items ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500">No entity timeline events recorded yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {(entityTimelineQ.data?.data.items ?? []).map((event) => (
                          <div key={event.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wider text-[#181b25]">
                                  {humanize(event.eventType)}
                                </p>
                                <p className="mt-1 break-words text-sm text-[#434654]">
                                  {timelinePayloadLine(event.payload)}
                                </p>
                              </div>
                              <span className="shrink-0 text-xs text-slate-400 sm:text-right">
                                {formatDateTime(event.occurredAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                <Link
                  to={`/admin/orders/${orderId}/timeline`}
                  className="group flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg bg-[#f2f3ff] p-4 transition-colors hover:bg-[#e6e7f6]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <History className="h-5 w-5 shrink-0 text-[#1653cc]" aria-hidden />
                    <span className="min-w-0 break-words text-xs font-bold uppercase tracking-tighter text-slate-900 sm:text-sm">
                      View full transaction audit timeline
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              <div className="flex flex-col justify-between rounded-xl bg-[#0f1117] p-5 text-white shadow-sm sm:p-8">
                <div>
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400 sm:mb-6">
                    Financial reconciliation
                  </h3>
                  <div className="space-y-3 text-sm sm:space-y-4">
                    <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                      <span className="text-slate-400">Subtotal (lines)</span>
                      <span className="font-mono tabular-nums">{formatMoney(linesSubtotalCents, currency)}</span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                      <span className="text-slate-400">Logistics & shipping</span>
                      <span className="font-mono tabular-nums">
                        {formatMoney(checkoutShippingCents, currency)}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                      <span className="text-slate-400">Estimated VAT / tax</span>
                      <span className="font-mono tabular-nums">{formatMoney(checkoutTaxCents, currency)}</span>
                    </div>
                    {appliedCheckoutCoupon ? (
                      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm italic text-red-300/90">
                        <span>Coupon ({appliedCheckoutCoupon.appliedCode})</span>
                        <span className="font-mono not-italic tabular-nums">
                          {formatMoney(appliedCheckoutCoupon.discountCents, currency)}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm italic text-red-300/90">
                      <span>Discounts</span>
                      <span className="font-mono not-italic tabular-nums">
                        {formatMoney(checkoutDiscountCents, currency)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 border-t border-white/10 pt-4 sm:mt-8 sm:pt-6">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Grand total
                    </span>
                    <span className="font-mono text-2xl font-bold tabular-nums text-[#dbe1ff] sm:text-3xl">
                      {formatMoney(grandCents, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <SurfaceCard
              title="Admin operations"
              description="Actions depend on your role. Invalid transitions are rejected and audited server-side."
              contentClassName="px-4 py-4 sm:px-5 sm:py-5"
            >
              <div className="grid gap-6 sm:gap-8 lg:grid-cols-2">
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
                    disabled={statusMut.isPending || statusMut.blocked || !canUpdateOrder}
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
                    disabled={assignMut.isPending || assignMut.blocked || !warehouseId.trim() || !canOverrideFulfillment}
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
                    disabled={shipMut.isPending || shipMut.blocked}
                    onClick={() => setConfirmAction("ship")}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                    title={
                      !canOverrideFulfillment
                        ? "Requires orders.override_fulfillment permission"
                        : !shipmentCreatable
                          ? "Warehouse is required before creating a shipment"
                          : undefined
                    }
                  >
                    {shipMut.isPending ? "Creating…" : "Create shipment"}
                  </button>
                </div>

                <div id="order-admin-campaign" className="scroll-mt-28 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Campaign attribution</h3>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    Campaign ID
                    <input
                      value={campaignId}
                      onChange={(ev) => setCampaignId(ev.target.value)}
                      className="font-mono rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Campaign id or leave blank to clear"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    Note (optional)
                    <input
                      value={campaignNote}
                      onChange={(ev) => setCampaignNote(ev.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder={entity.campaign?.name ? `Current: ${entity.campaign.name}` : "Explain attribution source"}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={campaignMut.isPending || campaignMut.blocked}
                    onClick={() => campaignMut.run(undefined)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                    title={
                      !canUpdateOrder
                        ? "Requires orders.update permission"
                        : !campaignHasChanges
                          ? "Change the campaign id or add a note before saving"
                          : undefined
                    }
                  >
                    {campaignMut.isPending ? "Saving…" : "Update campaign"}
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
                    disabled={cancelMut.isPending || cancelMut.blocked || !cancelReason.trim() || !canCancelOrder}
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
          className="sticky top-24 hidden h-fit shrink-0 flex-col items-center gap-4 self-start rounded-lg border border-white/5 bg-[#13161e] py-6 lg:flex"
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
        impactSummary={confirmAction === "cancel" ? "Irreversible — this order cannot be un-cancelled." : undefined}
        confirmLabel={confirmLabel}
        danger={confirmAction === "cancel"}
        confirmDisabled={confirmDisabled}
        onClose={() => setConfirmAction(null)}
        onConfirm={submitConfirmedAction}
      />
    </div>
  );
};
