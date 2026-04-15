/**
 * Hierarchical query key factory for the Catalog domain.
 *
 * Hierarchy:
 *   catalog → products → products.list(p) | products.detail(id) → variants(id) | media(id) | pricing(id)
 *          → categories → categories.list(p) | categories.detail(id)
 *          → brands → brands.list(p) | brands.detail(id)
 *          → tags
 */
export const catalogKeys = {
  all: () => ["admin-catalog"] as const,

  // Products
  products: () => [...catalogKeys.all(), "products"] as const,
  productLists: () => [...catalogKeys.products(), "list"] as const,
  productList: (params: Record<string, unknown>) =>
    [...catalogKeys.productLists(), params] as const,
  productDetails: () => [...catalogKeys.products(), "detail"] as const,
  product: (id: string) => [...catalogKeys.productDetails(), id] as const,
  productVariants: (id: string) =>
    [...catalogKeys.product(id), "variants"] as const,
  productMedia: (id: string) =>
    [...catalogKeys.product(id), "media"] as const,
  productPricing: (id: string) =>
    [...catalogKeys.product(id), "pricing"] as const,

  // Categories
  categories: () => [...catalogKeys.all(), "categories"] as const,
  categoryLists: () => [...catalogKeys.categories(), "list"] as const,
  categoryList: (params: Record<string, unknown>) =>
    [...catalogKeys.categoryLists(), params] as const,
  category: (id: string) => [...catalogKeys.categories(), id] as const,

  // Brands
  brands: () => [...catalogKeys.all(), "brands"] as const,
  brandLists: () => [...catalogKeys.brands(), "list"] as const,
  brandList: (params: Record<string, unknown>) =>
    [...catalogKeys.brandLists(), params] as const,
  brand: (id: string) => [...catalogKeys.brands(), id] as const,

  // Tags
  tags: () => [...catalogKeys.all(), "tags"] as const };
