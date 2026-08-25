CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_status_updatedAt_id_idx"
  ON "Product" ("status", "updatedAt", "id");

CREATE INDEX IF NOT EXISTS "Product_status_createdAt_id_idx"
  ON "Product" ("status", "createdAt", "id");

CREATE INDEX IF NOT EXISTS "Product_status_title_id_idx"
  ON "Product" ("status", "title", "id");

CREATE INDEX IF NOT EXISTS "Product_brandId_status_updatedAt_idx"
  ON "Product" ("brandId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "Product_title_trgm_idx"
  ON "Product" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_description_trgm_idx"
  ON "Product" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ProductVariant_productId_status_price_idx"
  ON "ProductVariant" ("productId", "status", "priceAmountCents");

CREATE INDEX IF NOT EXISTS "ProductMedia_productId_sortOrder_idx"
  ON "ProductMedia" ("productId", "sortOrder");

CREATE INDEX IF NOT EXISTS "ProductMedia_variantId_sortOrder_idx"
  ON "ProductMedia" ("variantId", "sortOrder");

CREATE INDEX IF NOT EXISTS "ProductCategory_categoryId_productId_idx"
  ON "ProductCategory" ("categoryId", "productId");

CREATE INDEX IF NOT EXISTS "InventoryStock_variantId_onHand_reserved_idx"
  ON "InventoryStock" ("variantId", "onHand", "reserved");
