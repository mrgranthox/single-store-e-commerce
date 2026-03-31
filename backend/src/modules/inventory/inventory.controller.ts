import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireAdminUserId } from "../../common/http/controller-actor";
import { sendSuccess } from "../../common/http/response";
import { asyncHandler } from "../../common/middleware/async-handler";
import {
  readValidatedBody,
  readValidatedParams,
  readValidatedQuery
} from "../../common/validation/validate-request";
import {
  createInventoryAdjustmentBodySchema,
  createWarehouseBodySchema,
  inventoryMovementsQuerySchema,
  inventoryQueueQuerySchema,
  inventoryStocksQuerySchema,
  updateWarehouseBodySchema,
  warehouseIdParamsSchema
} from "./inventory.schemas";
import {
  createInventoryAdjustments,
  createWarehouse,
  getInventoryOverview,
  getWarehouseDetail,
  listInventoryMovements,
  listInventoryStocks,
  listLowStockInventory,
  listOutOfStockInventory,
  listWarehouses,
  updateWarehouse
} from "./inventory.service";

export const getAdminInventoryOverview = asyncHandler(async (_request, response) => {
  const entity = await getInventoryOverview();

  return sendSuccess(response, {
    data: {
      entity
    }
  });
});

export const listAdminLowStockInventory = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof inventoryQueueQuerySchema>>(request);
  const data = await listLowStockInventory(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: {
      ...data.pagination,
      ...data.queueMeta
    }
  });
});

export const listAdminOutOfStockInventory = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof inventoryQueueQuerySchema>>(request);
  const data = await listOutOfStockInventory(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: {
      ...data.pagination,
      ...data.queueMeta
    }
  });
});

export const listAdminInventoryStocks = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof inventoryStocksQuerySchema>>(request);
  const data = await listInventoryStocks(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const listAdminInventoryMovements = asyncHandler(async (request, response) => {
  const query = readValidatedQuery<z.infer<typeof inventoryMovementsQuerySchema>>(request);
  const data = await listInventoryMovements(query);

  return sendSuccess(response, {
    data: {
      items: data.items
    },
    meta: data.pagination
  });
});

export const createAdminInventoryAdjustments = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createInventoryAdjustmentBodySchema>>(request);
  const items = await createInventoryAdjustments({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    ...body
  });

  return sendSuccess(response, {
    data: {
      items
    }
  });
});

export const listAdminWarehouses = asyncHandler(async (_request, response) => {
  const items = await listWarehouses();

  return sendSuccess(response, {
    data: {
      items
    }
  });
});

export const createAdminWarehouse = asyncHandler(async (request, response) => {
  const body = readValidatedBody<z.infer<typeof createWarehouseBodySchema>>(request);
  const entity = await createWarehouse({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    code: body.code,
    name: body.name,
    ...(body.metadata !== undefined ? { metadata: body.metadata as Prisma.InputJsonValue } : {}),
    operationalStatus: body.operationalStatus
  });

  return sendSuccess(response, {
    statusCode: 201,
    data: {
      entity
    }
  });
});

export const getAdminWarehouse = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof warehouseIdParamsSchema>>(request);
  const entity = await getWarehouseDetail(params.warehouseId);

  return sendSuccess(response, {
    data: {
      entity
    }
  });
});

export const updateAdminWarehouse = asyncHandler(async (request, response) => {
  const params = readValidatedParams<z.infer<typeof warehouseIdParamsSchema>>(request);
  const body = readValidatedBody<z.infer<typeof updateWarehouseBodySchema>>(request);
  const entity = await updateWarehouse({
    actorAdminUserId: requireAdminUserId(request.context.actor.adminUserId),
    warehouseId: params.warehouseId,
    code: body.code,
    name: body.name,
    operationalStatus: body.operationalStatus,
    ...(body.metadata !== undefined
      ? { metadata: body.metadata === null ? null : (body.metadata as Prisma.InputJsonValue) }
      : {})
  });

  return sendSuccess(response, {
    data: {
      entity
    }
  });
});
