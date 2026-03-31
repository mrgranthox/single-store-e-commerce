import { apiRequest, ApiError } from "@/lib/api/http";

export type InventoryKpiDeltaSincePrior = {
  baselineCapturedAt: string;
  trackedLineCountPct: number | null;
  healthyStockCountPct: number | null;
  lowStockCountPct: number | null;
  outOfStockCountPct: number | null;
  inTransitMerchandiseValueCentsPct: number | null;
};

export type InventoryOverviewEntity = {
  totals: {
    onHand: number;
    reserved: number;
    available: number;
  };
  lowStockCount: number;
  outOfStockCount: number;
  trackedLineCount: number;
  healthyStockCount: number;
  /** Sum of order line totals (qty × unit price) for CONFIRMED/PROCESSING orders with DISPATCHED or IN_TRANSIT shipments */
  inTransitMerchandiseValueCents?: number;
  /** Compared to latest overview snapshot older than 24h; null until baseline exists */
  kpiDeltaSincePrior?: InventoryKpiDeltaSincePrior | null;
};

export type InventoryOverviewResponse = {
  success: true;
  data: { entity: InventoryOverviewEntity };
};

export const getInventoryOverview = async (accessToken: string): Promise<InventoryOverviewResponse> =>
  apiRequest<InventoryOverviewResponse>({
    path: "/api/admin/inventory/overview",
    accessToken
  });

export type InventoryStockRow = {
  id: string;
  status?: string;
  variant: {
    id: string;
    sku: string;
    status?: string;
    costAmountCents?: number | null;
    priceAmountCents?: number | null;
    product: { id: string; slug: string; title: string; thumbnailUrl?: string | null };
  };
  warehouse: { id: string; code: string; name: string };
  stock: {
    onHand: number;
    reserved: number;
    available: number;
    configuredReorderLevel?: number;
    effectiveReorderLevel: number;
  };
  health?: {
    lowStock: boolean;
    outOfStock: boolean;
  };
  lastMovement?: {
    id: string;
    movementType: string;
    deltaOnHand: number;
    deltaReserved: number;
    createdAt: string;
    reason: string | null;
  } | null;
  updatedAt: string;
  /** Distinct CONFIRMED/PROCESSING orders containing this variant (any line) */
  ordersAffectedCount?: number;
};

export type InventoryQueueQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  warehouseId?: string;
  sortBy?: "updatedAt" | "available" | "sku" | "productTitle";
  sortOrder?: "asc" | "desc";
};

const queueQueryString = (query: InventoryQueueQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.warehouseId?.trim()) {
    params.set("warehouseId", query.warehouseId.trim());
  }
  if (query.sortBy) {
    params.set("sortBy", query.sortBy);
  }
  if (query.sortOrder) {
    params.set("sortOrder", query.sortOrder);
  }
  return `?${params.toString()}`;
};

export type InventoryQueueListResponse = {
  success: true;
  data: { items: InventoryStockRow[] };
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    inTransitMerchandiseValueCents?: number;
    openOrdersDistinctForOosVariants?: number;
  };
};

export const listLowStockInventory = async (
  accessToken: string,
  query: InventoryQueueQuery = {}
): Promise<InventoryQueueListResponse> =>
  apiRequest<InventoryQueueListResponse>({
    path: `/api/admin/inventory/low-stock${queueQueryString(query)}`,
    accessToken
  });

export const listOutOfStockInventory = async (
  accessToken: string,
  query: InventoryQueueQuery = {}
): Promise<InventoryQueueListResponse> =>
  apiRequest<InventoryQueueListResponse>({
    path: `/api/admin/inventory/out-of-stock${queueQueryString(query)}`,
    accessToken
  });

export type InventoryStocksQuery = InventoryQueueQuery & {
  healthFilter?: "all" | "healthy" | "low_stock" | "out_of_stock";
  minAvailable?: number;
  maxAvailable?: number;
};

const stocksQueryString = (query: InventoryStocksQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 20));
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.warehouseId?.trim()) {
    params.set("warehouseId", query.warehouseId.trim());
  }
  if (query.sortBy) {
    params.set("sortBy", query.sortBy);
  }
  if (query.sortOrder) {
    params.set("sortOrder", query.sortOrder);
  }
  if (query.healthFilter && query.healthFilter !== "all") {
    params.set("healthFilter", query.healthFilter);
  }
  if (query.minAvailable !== undefined && Number.isFinite(query.minAvailable)) {
    params.set("minAvailable", String(query.minAvailable));
  }
  if (query.maxAvailable !== undefined && Number.isFinite(query.maxAvailable)) {
    params.set("maxAvailable", String(query.maxAvailable));
  }
  return `?${params.toString()}`;
};

export const listInventoryStocks = async (
  accessToken: string,
  query: InventoryStocksQuery = {}
): Promise<InventoryQueueListResponse> =>
  apiRequest<InventoryQueueListResponse>({
    path: `/api/admin/inventory/stocks${stocksQueryString({ ...query, healthFilter: query.healthFilter ?? "all" })}`,
    accessToken
  });

export type WarehouseListItem = {
  id: string;
  code: string;
  name: string;
  operationalStatus?: string;
  metadata?: unknown;
  locationLabel?: string | null;
  inventoryItemCount: number;
  shipmentCount: number;
  lowStockCount?: number;
  outOfStockCount?: number;
  totals: { onHand: number; reserved: number; available: number };
  updatedAt: string;
};

export type WarehousesListResponse = {
  success: true;
  data: { items: WarehouseListItem[] };
};

export const listAdminWarehouses = async (accessToken: string): Promise<WarehousesListResponse> =>
  apiRequest<WarehousesListResponse>({
    path: "/api/admin/inventory/warehouses",
    accessToken
  });

export type CreateWarehouseBody = {
  code: string;
  name: string;
  metadata?: unknown;
  operationalStatus?: "ACTIVE" | "MAINTENANCE" | "OFFLINE";
};

export const createAdminWarehouse = async (
  accessToken: string,
  body: CreateWarehouseBody
): Promise<{ success: true; data: { entity: { id: string; code: string; name: string } } }> =>
  apiRequest({
    method: "POST",
    path: "/api/admin/inventory/warehouses",
    accessToken,
    body
  });

export type InventoryMovementRow = {
  id: string;
  movementType: string;
  deltaOnHand: number;
  deltaReserved: number;
  resultingOnHand: number;
  resultingReserved: number;
  reason: string | null;
  actorAdminUserId: string | null;
  reservationId: string | null;
  orderId: string | null;
  paymentId: string | null;
  returnId: string | null;
  createdAt: string;
  warehouse: { id: string; code: string; name: string };
  variant: { id: string; sku: string; product: { id: string; slug: string; title: string } };
};

export type InventoryMovementsQuery = {
  page?: number;
  page_size?: number;
  sku?: string;
  warehouseId?: string;
  productId?: string;
  actorAdminUserId?: string;
  movementType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortOrder?: "asc" | "desc";
};

const movementsQueryString = (query: InventoryMovementsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.page_size ?? 25));
  if (query.sku?.trim()) {
    params.set("sku", query.sku.trim());
  }
  if (query.productId?.trim()) {
    params.set("productId", query.productId.trim());
  }
  if (query.warehouseId?.trim()) {
    params.set("warehouseId", query.warehouseId.trim());
  }
  if (query.actorAdminUserId?.trim()) {
    params.set("actorAdminUserId", query.actorAdminUserId.trim());
  }
  if (query.movementType?.trim()) {
    params.set("movementType", query.movementType.trim());
  }
  if (query.dateFrom?.trim()) {
    params.set("dateFrom", query.dateFrom.trim());
  }
  if (query.dateTo?.trim()) {
    params.set("dateTo", query.dateTo.trim());
  }
  if (query.sortOrder) {
    params.set("sortOrder", query.sortOrder);
  }
  return `?${params.toString()}`;
};

export type InventoryMovementsListResponse = {
  success: true;
  data: { items: InventoryMovementRow[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listInventoryMovements = async (
  accessToken: string,
  query: InventoryMovementsQuery = {}
): Promise<InventoryMovementsListResponse> =>
  apiRequest<InventoryMovementsListResponse>({
    path: `/api/admin/inventory/movements${movementsQueryString(query)}`,
    accessToken
  });

export type WarehouseShipmentSummary = {
  id: string;
  orderId: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseDetailEntity = {
  id: string;
  code: string;
  name: string;
  operationalStatus?: string;
  metadata?: unknown;
  locationLabel?: string | null;
  createdAt: string;
  updatedAt: string;
  summary: {
    inventoryItemCount: number;
    shipmentCount: number;
    totals: { onHand: number; reserved: number; available: number };
    lowStockCount: number;
    outOfStockCount: number;
  };
  stockHealth: { items: InventoryStockRow[] };
  recentMovements: InventoryMovementRow[];
  linkedShipments: WarehouseShipmentSummary[];
};

export type WarehouseDetailResponse = {
  success: true;
  data: { entity: WarehouseDetailEntity };
};

export const getAdminWarehouseDetail = async (
  accessToken: string,
  warehouseId: string
): Promise<WarehouseDetailResponse> =>
  apiRequest<WarehouseDetailResponse>({
    path: `/api/admin/inventory/warehouses/${encodeURIComponent(warehouseId)}`,
    accessToken
  });

export type WarehouseInventoryListResponse = {
  success: true;
  data: { items: InventoryStockRow[] };
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

export const listWarehouseInventory = async (
  accessToken: string,
  warehouseId: string,
  page = 1,
  page_size = 25
): Promise<WarehouseInventoryListResponse> =>
  listInventoryStocks(accessToken, {
    page,
    page_size,
    warehouseId,
    healthFilter: "all",
    sortBy: "productTitle",
    sortOrder: "asc"
  });

export type CreateInventoryAdjustmentBody = {
  reason: string;
  note?: string;
  confirmationReason?: string;
  items: Array<{
    variantId: string;
    warehouseId: string;
    deltaOnHand: number;
  }>;
};

export type CreateInventoryAdjustmentResponse = {
  success: true;
  data: unknown;
};

export const createInventoryAdjustment = async (
  accessToken: string,
  body: CreateInventoryAdjustmentBody
): Promise<CreateInventoryAdjustmentResponse> =>
  apiRequest<CreateInventoryAdjustmentResponse>({
    method: "POST",
    path: "/api/admin/inventory/adjustments",
    accessToken,
    body
  });

export { ApiError };
