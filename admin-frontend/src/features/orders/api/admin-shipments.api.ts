import { apiRequest } from "@/lib/api/http";

export type AdminShipmentListItem = {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminShipmentsListResponse = {
  success: true;
  data: {
    items: AdminShipmentListItem[];
  };
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ListAdminShipmentsQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  status?: string;
};

const buildQuery = (query: ListAdminShipmentsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export const listAdminShipments = async (
  accessToken: string,
  query: ListAdminShipmentsQuery = {}
): Promise<AdminShipmentsListResponse> =>
  apiRequest<AdminShipmentsListResponse>({
    path: `/api/admin/shipments${buildQuery(query)}`,
    accessToken
  });

export type BulkShipmentStatusResultRow =
  | { shipmentId: string; ok: true }
  | { shipmentId: string; ok: false; error: string };

export type BulkShipmentStatusResponse = {
  success: true;
  data: {
    results: BulkShipmentStatusResultRow[];
    succeeded: number;
    failed: number;
    total: number;
  };
};

export const bulkUpdateAdminShipmentStatus = async (
  accessToken: string,
  body: { shipmentIds: string[]; shipmentStatus: string; note?: string }
): Promise<BulkShipmentStatusResponse> =>
  apiRequest<BulkShipmentStatusResponse>({
    method: "POST",
    path: "/api/admin/shipments/bulk-status",
    accessToken,
    body
  });
