import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createApp } from "../app/app";
import { prisma } from "../config/prisma";
import { closeQueues } from "../config/queue";
import { closeRedisConnection } from "../config/redis";
import { flushSentry } from "../config/sentry";
import { requestJson, startHttpsServer, stopServer } from "./support/http";
import { deleteRedisKeysByPattern } from "./support/redis";

const buildAdminHeaders = (
  adminUser: {
    id: string;
    email: string;
  },
  permissions: string[]
) => ({
  "x-dev-admin-user-id": adminUser.id,
  "x-dev-email": adminUser.email,
  "x-dev-permissions": permissions.join(",")
});

const issueAdminStepUpHeader = async (input: {
  baseUrl: string;
  adminUser: {
    id: string;
    email: string;
  };
  permissions: string[];
}) => {
  const response = await requestJson<{
    success: true;
    data: {
      token: string;
    };
  }>({
    baseUrl: input.baseUrl,
    method: "POST",
    path: "/api/admin/auth/step-up",
    headers: buildAdminHeaders(input.adminUser, input.permissions),
    body: {
      email: input.adminUser.email,
      password: "test-bypass-password"
    }
  });

  assert.equal(response.statusCode, 200);
  const token = response.json?.data.token;
  assert.ok(token);

  return {
    "x-admin-step-up-token": token
  };
};

export const runAdminOpsIntegrationSuite = async () => {
  const runId = randomUUID().slice(0, 8);
  const step = (label: string) => {
    console.error(`[ops-itest] ${label}`);
  };
  await deleteRedisKeysByPattern("rl:*");
  const { server, baseUrl } = await startHttpsServer(createApp());

  try {
    step("create admin actor");
    const adminUser = await prisma.adminUser.create({
      data: {
        email: `ops.admin.${runId}@example.com`,
        clerkAdminUserId: `clerk-admin-ops-${runId}`,
        status: "ACTIVE"
      }
    });

    const fullAdminHeaders = buildAdminHeaders(adminUser, [
      "inventory.read",
      "inventory.adjust",
      "inventory.manage_warehouses",
      "catalog.products.read",
      "catalog.products.write",
      "catalog.products.publish",
      "catalog.products.change_price",
      "catalog.categories.read",
      "catalog.categories.write",
      "catalog.brands.read",
      "catalog.brands.write",
      "content.pages.read",
      "content.pages.write",
      "orders.read",
      "orders.override_fulfillment",
      "reports.read",
      "settings.write",
      "security.audit.read"
    ]);

    step("block sensitive settings mutation without step-up token");
    const settingsKey = `ops.${runId}.feature_flag`;
    const blockedSettingsResponse = await requestJson({
      baseUrl,
      method: "PATCH",
      path: "/api/admin/settings",
      headers: fullAdminHeaders,
      body: {
        settings: [
          {
            key: settingsKey,
            value: true
          }
        ]
      }
    });
    assert.equal(blockedSettingsResponse.statusCode, 403);

    step("update system settings and assert audit trail");
    const stepUpHeaders = await issueAdminStepUpHeader({
      baseUrl,
      adminUser,
      permissions: [
        "settings.write"
      ]
    });
    const updateSettingsResponse = await requestJson({
      baseUrl,
      method: "PATCH",
      path: "/api/admin/settings",
      headers: {
        ...fullAdminHeaders,
        ...stepUpHeaders
      },
      body: {
        settings: [
          {
            key: settingsKey,
            value: true
          }
        ]
      }
    });
    assert.equal(updateSettingsResponse.statusCode, 200);
    const updatedSetting = await prisma.systemSetting.findUnique({
      where: {
        key: settingsKey
      }
    });
    assert.ok(updatedSetting);
    assert.equal(updatedSetting?.value, true);
    const settingsAuditLog = await prisma.auditLog.findFirst({
      where: {
        actorAdminUserId: adminUser.id,
        actionCode: "system_settings.updated"
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    assert.ok(settingsAuditLog);
    const settingsAdminActionLog = await prisma.adminActionLog.findFirst({
      where: {
        adminUserId: adminUser.id,
        actionCode: "system_settings.updated"
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    assert.ok(settingsAdminActionLog);

    step("load public client configs");
    const [customerConfigResponse, mobileConfigResponse, adminConfigResponse] = await Promise.all([
      requestJson<{
        success: true;
        data: {
          surface: string;
          routes: {
            support: {
              abuseChallenge: {
                enabled: boolean;
                tokenField: string;
              };
            };
          };
        };
      }>({
        baseUrl,
        method: "GET",
        path: "/api/client-config/customer"
      }),
      requestJson<{
        success: true;
        data: {
          surface: string;
          routes: {
            support: {
              abuseChallenge: {
                enabled: boolean;
                tokenField: string;
              };
            };
          };
        };
      }>({
        baseUrl,
        method: "GET",
        path: "/api/client-config/mobile"
      }),
      requestJson<{
        success: true;
        data: {
          surface: string;
          routes: {
            media: {
              contentUploadIntent: string;
            };
          };
        };
      }>({
        baseUrl,
        method: "GET",
        path: "/api/client-config/admin"
      })
    ]);

    assert.equal(customerConfigResponse.statusCode, 200);
    assert.equal(customerConfigResponse.json?.data.surface, "customer");
    assert.equal(customerConfigResponse.json?.data.routes.support.abuseChallenge.tokenField, "captchaToken");
    assert.equal(mobileConfigResponse.statusCode, 200);
    assert.equal(mobileConfigResponse.json?.data.surface, "mobile");
    assert.equal(adminConfigResponse.statusCode, 200);
    assert.equal(adminConfigResponse.json?.data.surface, "admin");

    step("enforce inventory permission denial");
    const forbiddenAdjustmentResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: "/api/admin/inventory/adjustments",
      headers: buildAdminHeaders(adminUser, ["inventory.read"]),
      body: {
        reason: "forbidden test",
        items: []
      }
    });
    assert.equal(forbiddenAdjustmentResponse.statusCode, 403);

    step("create warehouse");
    const createWarehouseResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          id: string;
          code: string;
          name: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/admin/inventory/warehouses",
      headers: fullAdminHeaders,
      body: {
        code: `OPSWH${runId.toUpperCase()}`,
        name: `Ops Warehouse ${runId}`
      }
    });

    assert.equal(createWarehouseResponse.statusCode, 201);
    const warehouseId = createWarehouseResponse.json?.data.entity.id;
    assert.ok(warehouseId);

    step("update warehouse");
    const updateWarehouseResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          id: string;
          name: string;
        };
      };
    }>({
      baseUrl,
      method: "PATCH",
      path: `/api/admin/inventory/warehouses/${warehouseId}`,
      headers: fullAdminHeaders,
      body: {
        name: `Ops Warehouse ${runId} Updated`
      }
    });

    assert.equal(updateWarehouseResponse.statusCode, 200);
    assert.equal(updateWarehouseResponse.json?.data.entity.name, `Ops Warehouse ${runId} Updated`);

    step("create catalog category and brand");
    const [createCategoryResponse, createBrandResponse] = await Promise.all([
      requestJson<{
        success: true;
        data: {
          entity: {
            id: string;
          };
        };
      }>({
        baseUrl,
        method: "POST",
        path: "/api/admin/catalog/categories",
        headers: fullAdminHeaders,
        body: {
          slug: `ops-category-${runId}`,
          name: `Ops Category ${runId}`
        }
      }),
      requestJson<{
        success: true;
        data: {
          entity: {
            id: string;
          };
        };
      }>({
        baseUrl,
        method: "POST",
        path: "/api/admin/catalog/brands",
        headers: fullAdminHeaders,
        body: {
          slug: `ops-brand-${runId}`,
          name: `Ops Brand ${runId}`
        }
      })
    ]);

    assert.equal(createCategoryResponse.statusCode, 201);
    assert.equal(createBrandResponse.statusCode, 201);
    const categoryId = createCategoryResponse.json?.data.entity.id;
    const brandId = createBrandResponse.json?.data.entity.id;
    assert.ok(categoryId);
    assert.ok(brandId);

    step("publish category");
    const publishCategoryResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: `/api/admin/catalog/categories/${categoryId}/publish`,
      headers: fullAdminHeaders,
      body: {
        reason: "ops integration publish"
      }
    });

    assert.equal(publishCategoryResponse.statusCode, 200);

    step("publish brand");
    const publishBrandResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: `/api/admin/catalog/brands/${brandId}/publish`,
      headers: fullAdminHeaders,
      body: {
        reason: "ops integration publish"
      }
    });

    assert.equal(publishBrandResponse.statusCode, 200);

    step("create product");
    const createProductResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          id: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/admin/catalog/products",
      headers: fullAdminHeaders,
      body: {
        slug: `ops-product-${runId}`,
        title: `Ops Product ${runId}`,
        description: "Inventory, reporting, and fulfillment integration product.",
        brandId,
        categoryIds: [categoryId]
      }
    });

    assert.equal(createProductResponse.statusCode, 201);
    const productId = createProductResponse.json?.data.entity.id;
    assert.ok(productId);
    const product = await prisma.product.findUniqueOrThrow({
      where: {
        id: productId
      }
    });
    const productSlug = product.slug;

    step("create variant");
    const createVariantResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          id: string;
          sku: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: `/api/admin/catalog/products/${productId}/variants`,
      headers: fullAdminHeaders,
      body: {
        sku: `OPS-SKU-${runId}`,
        priceAmountCents: 21000,
        compareAtPriceAmountCents: 25000,
        priceCurrency: "GHS"
      }
    });

    assert.equal(createVariantResponse.statusCode, 201);
    const variantId = createVariantResponse.json?.data.entity.id;
    assert.ok(variantId);

    step("update pricing and publish product");
    const [pricingResponse, publishProductResponse] = await Promise.all([
      requestJson({
        baseUrl,
        method: "PATCH",
        path: `/api/admin/catalog/products/${productId}/pricing`,
        headers: fullAdminHeaders,
        body: {
          variants: [
            {
              variantId,
              priceAmountCents: 20500,
              compareAtPriceAmountCents: 24000,
              priceCurrency: "GHS"
            }
          ]
        }
      }),
      requestJson({
        baseUrl,
        method: "POST",
        path: `/api/admin/catalog/products/${productId}/publish`,
        headers: fullAdminHeaders,
        body: {
          reason: "ops integration publish"
        }
      })
    ]);

    assert.equal(pricingResponse.statusCode, 200);
    assert.equal(publishProductResponse.statusCode, 200);

    step("create media upload intent and media metadata");
    const uploadIntentResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: `/api/admin/catalog/products/${productId}/media/upload-intents`,
      headers: fullAdminHeaders,
      body: {
        fileName: `ops-${runId}.jpg`,
        contentType: "image/jpeg",
        fileSizeBytes: 2048,
        resourceType: "image"
      }
    });

    assert.equal(uploadIntentResponse.statusCode, 201);

    const createMediaResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          id: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: `/api/admin/catalog/products/${productId}/media`,
      headers: fullAdminHeaders,
      body: {
        url: `https://cdn.example.test/catalog/${runId}.jpg`,
        kind: "IMAGE",
        storageProvider: "external",
        sortOrder: 0
      }
    });

    assert.equal(createMediaResponse.statusCode, 201);

    step("seed inventory stock and adjust down into low-stock");
    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        variantId,
        warehouseId,
        onHand: 10,
        reserved: 0,
        reorderLevel: 2
      }
    });

    const adjustmentResponse = await requestJson<{
      success: true;
      data: {
        items: Array<{
          inventoryStockId: string;
          stock: {
            onHand: number;
          };
        }>;
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/admin/inventory/adjustments",
      headers: fullAdminHeaders,
      body: {
        reason: "ops integration stock adjustment",
        items: [
          {
            variantId,
            warehouseId,
            deltaOnHand: -9
          }
        ]
      }
    });

    assert.equal(adjustmentResponse.statusCode, 200);
    assert.equal(adjustmentResponse.json?.data.items[0]?.inventoryStockId, inventoryStock.id);

    step("inventory overview, low-stock, movements");
    const [overviewResponse, lowStockResponse, movementsResponse, inventorySummaryResponse] =
      await Promise.all([
        requestJson<{
          success: true;
          data: {
            entity: {
              lowStockCount: number;
            };
          };
        }>({
          baseUrl,
          method: "GET",
          path: "/api/admin/inventory/overview",
          headers: fullAdminHeaders
        }),
        requestJson<{
          success: true;
          data: {
            items: Array<{
              variant: {
                id: string;
              };
            }>;
          };
        }>({
          baseUrl,
          method: "GET",
          path: "/api/admin/inventory/low-stock?page=1&page_size=20",
          headers: fullAdminHeaders
        }),
        requestJson<{
          success: true;
          data: {
            items: Array<{
              variant: {
                id: string;
              };
            }>;
          };
        }>({
          baseUrl,
          method: "GET",
          path: "/api/admin/inventory/movements?page=1&page_size=20",
          headers: fullAdminHeaders
        }),
        requestJson({
          baseUrl,
          method: "GET",
          path: `/api/admin/catalog/products/${productId}/inventory-summary`,
          headers: fullAdminHeaders
        })
      ]);

    assert.equal(overviewResponse.statusCode, 200);
    assert.ok((overviewResponse.json?.data.entity.lowStockCount ?? 0) >= 1);
    assert.equal(lowStockResponse.statusCode, 200);
    assert.ok(lowStockResponse.json?.data.items.some((item) => item.variant.id === variantId));
    assert.equal(movementsResponse.statusCode, 200);
    assert.ok(movementsResponse.json?.data.items.some((item) => item.variant.id === variantId));
    assert.equal(inventorySummaryResponse.statusCode, 200);

    step("create draft page, publish, and fetch publicly");
    const createPageResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          id: string;
          slug: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/admin/content/pages",
      headers: fullAdminHeaders,
      body: {
        slug: `ops-page-${runId}`,
        title: `Ops Page ${runId}`,
        status: "DRAFT",
        content: {
          blocks: [{ type: "hero", title: `Ops Page ${runId}` }]
        }
      }
    });

    assert.equal(createPageResponse.statusCode, 201);
    const pageId = createPageResponse.json?.data.entity.id;
    const pageSlug = createPageResponse.json?.data.entity.slug;
    assert.ok(pageId);
    assert.ok(pageSlug);

    const publishPageResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: `/api/admin/content/pages/${pageId}/publish`,
      headers: fullAdminHeaders,
      body: {
        reason: "ops publish"
      }
    });
    assert.equal(publishPageResponse.statusCode, 200);

    const publicPageResponse = await requestJson({
      baseUrl,
      method: "GET",
      path: `/api/content/pages/${pageSlug}`
    });
    assert.equal(publicPageResponse.statusCode, 200);

    step("create banner upload intent, banner, publish, and fetch publicly");
    const contentUploadIntentResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: "/api/admin/content/media/upload-intents",
      headers: fullAdminHeaders,
      body: {
        fileName: `banner-${runId}.jpg`,
        contentType: "image/jpeg",
        fileSizeBytes: 2048,
        resourceType: "image"
      }
    });
    assert.equal(contentUploadIntentResponse.statusCode, 201);

    const createBannerResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          id: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/admin/content/banners",
      headers: fullAdminHeaders,
      body: {
        placement: "home_hero",
        status: "DRAFT",
        sortOrder: 0,
        title: `Ops Banner ${runId}`,
        mediaUrl: `https://cdn.example.test/banners/${runId}.jpg`,
        mediaStorageProvider: "external",
        linkUrl: "https://example.com/promo"
      }
    });
    assert.equal(createBannerResponse.statusCode, 201);
    const bannerId = createBannerResponse.json?.data.entity.id;
    assert.ok(bannerId);

    const publishBannerResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: `/api/admin/content/banners/${bannerId}/publish`,
      headers: fullAdminHeaders,
      body: {
        reason: "ops publish banner"
      }
    });
    assert.equal(publishBannerResponse.statusCode, 200);

    const publicBannersResponse = await requestJson<{
      success: true;
      data: {
        items: Array<{
          id: string;
        }>;
      };
    }>({
      baseUrl,
      method: "GET",
      path: "/api/content/banners?placement=home_hero"
    });
    assert.equal(publicBannersResponse.statusCode, 200);
    assert.ok(publicBannersResponse.json?.data.items.some((item) => item.id === bannerId));

    step("fetch published catalog product");
    const publicProductResponse = await requestJson({
      baseUrl,
      method: "GET",
      path: `/api/catalog/products/${productSlug}`
    });
    assert.equal(publicProductResponse.statusCode, 200);

    step("seed confirmed order and create shipment");
    const order = await prisma.order.create({
      data: {
        orderNumber: `OPS-ORD-${runId}`,
        status: "CONFIRMED",
        addressSnapshot: {
          fullName: "Ops Customer",
          email: `ops.customer.${runId}@example.com`,
          city: "Accra",
          region: "Greater Accra",
          country: "Ghana"
        }
      }
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        variantId,
        productTitleSnapshot: `Ops Product ${runId}`,
        unitPriceAmountCents: 20500,
        unitPriceCurrency: "GHS",
        quantity: 1
      }
    });

    const createShipmentResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          id: string;
          status: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: `/api/admin/orders/${order.id}/shipments`,
      headers: fullAdminHeaders,
      body: {
        warehouseId,
        carrier: "DHL",
        trackingNumber: `OPS-TRK-${runId}`
      }
    });

    assert.equal(createShipmentResponse.statusCode, 201);
    const shipmentId = createShipmentResponse.json?.data.entity.id;
    assert.ok(shipmentId);

    step("update shipment and progress tracking events through legal shipment states");
    const updateShipmentResponse = await requestJson({
      baseUrl,
      method: "PATCH",
      path: `/api/admin/shipments/${shipmentId}`,
      headers: fullAdminHeaders,
      body: {
        carrier: "DHL Express"
      }
    });

    assert.equal(updateShipmentResponse.statusCode, 200);

    const trackingEventBodies = [
      {
        statusLabel: "Packing",
        shipmentStatus: "PACKING",
        eventType: "packing",
        location: "Accra Warehouse"
      },
      {
        statusLabel: "Dispatched",
        shipmentStatus: "DISPATCHED",
        eventType: "dispatch",
        location: "Accra Sort Hub"
      },
      {
        statusLabel: "Delivered",
        shipmentStatus: "DELIVERED",
        eventType: "delivery",
        location: "Accra"
      }
    ] as const;

    const trackingEventResponses = [];
    for (const body of trackingEventBodies) {
      trackingEventResponses.push(
        await requestJson({
          baseUrl,
          method: "POST",
          path: `/api/admin/shipments/${shipmentId}/tracking-events`,
          headers: fullAdminHeaders,
          body
        })
      );
    }

    for (const response of trackingEventResponses) {
      assert.equal(response.statusCode, 201);
    }

    const [shipmentDetailResponse, shipmentTrackingResponse] = await Promise.all([
      requestJson({
        baseUrl,
        method: "GET",
        path: `/api/admin/shipments/${shipmentId}`,
        headers: fullAdminHeaders
      }),
      requestJson({
        baseUrl,
        method: "GET",
        path: `/api/admin/shipments/${shipmentId}/tracking`,
        headers: fullAdminHeaders
      })
    ]);

    assert.equal(shipmentDetailResponse.statusCode, 200);
    assert.equal(shipmentTrackingResponse.statusCode, 200);

    const completedOrder = await prisma.order.findUniqueOrThrow({
      where: {
        id: order.id
      }
    });
    assert.equal(completedOrder.status, "COMPLETED");

    step("read reports");
    const reportPaths = [
      "/api/admin/reports/overview",
      "/api/admin/reports/products",
      "/api/admin/reports/inventory",
      "/api/admin/reports/marketing",
      "/api/admin/reports/post-purchase"
    ];

    const reportResponses = await Promise.all(
      reportPaths.map((path) =>
        requestJson({
          baseUrl,
          method: "GET",
          path,
          headers: fullAdminHeaders
        })
      )
    );

    for (const response of reportResponses) {
      assert.equal(response.statusCode, 200);
    }

    console.error("[ops-itest] completed successfully");
  } finally {
    await stopServer(server);
    await Promise.allSettled([closeQueues(), closeRedisConnection(), prisma.$disconnect(), flushSentry()]);
  }
};

void runAdminOpsIntegrationSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("[ops-itest] failed");
    console.error(error);
    process.exit(1);
  });
