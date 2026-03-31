import { randomUUID } from "node:crypto";

export type StorefrontAvailabilityFilter =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "available"
  | "unavailable";

export type NormalizedStorefrontQuery = {
  page: number;
  page_size: number;
  q?: string;
  categoryId?: string;
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  availability?: StorefrontAvailabilityFilter;
  sortBy: "updatedAt" | "createdAt" | "title";
  sortOrder: "asc" | "desc";
};

export const normalizeStorefrontSort = (input: {
  sortBy?: "updatedAt" | "createdAt" | "title";
  sortOrder?: "asc" | "desc";
  sort?: "newest" | "oldest" | "title_asc" | "title_desc";
}) => {
  let sortBy: "updatedAt" | "createdAt" | "title" = input.sortBy ?? "updatedAt";
  let sortOrder: "asc" | "desc" = input.sortOrder ?? "desc";

  switch (input.sort) {
    case "newest":
      sortBy = "createdAt";
      sortOrder = "desc";
      break;
    case "oldest":
      sortBy = "createdAt";
      sortOrder = "asc";
      break;
    case "title_asc":
      sortBy = "title";
      sortOrder = "asc";
      break;
    case "title_desc":
      sortBy = "title";
      sortOrder = "desc";
      break;
    default:
      break;
  }

  return {
    sortBy,
    sortOrder
  };
};

export const buildNormalizedStorefrontQuery = (input: {
  page: number;
  page_size?: number;
  limit?: number;
  q?: string;
  query?: string;
  categoryId?: string;
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  availability?: StorefrontAvailabilityFilter;
  sortBy?: "updatedAt" | "createdAt" | "title";
  sortOrder?: "asc" | "desc";
  sort?: "newest" | "oldest" | "title_asc" | "title_desc";
}): NormalizedStorefrontQuery => {
  const { sortBy, sortOrder } = normalizeStorefrontSort(input);

  return {
    page: input.page,
    page_size: input.page_size ?? input.limit ?? 20,
    q: input.q ?? input.query,
    categoryId: input.categoryId,
    brandId: input.brandId,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    rating: input.rating,
    availability: input.availability,
    sortBy,
    sortOrder
  };
};

export type MobileCheckoutAddressInput = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  country: string;
  region: string;
  city: string;
  addressLine1: string;
  addressLine2?: string | null;
  postalCode?: string | null;
};

export const buildCheckoutAddress = (input: {
  contact?: {
    email?: string | null;
    phone?: string | null;
  };
  shippingAddress: MobileCheckoutAddressInput;
}) => ({
  fullName: input.shippingAddress.fullName,
  email: input.contact?.email ?? input.shippingAddress.email ?? undefined,
  phone: input.contact?.phone ?? input.shippingAddress.phone ?? "",
  country: input.shippingAddress.country,
  region: input.shippingAddress.region,
  city: input.shippingAddress.city,
  line1: input.shippingAddress.addressLine1,
  line2: input.shippingAddress.addressLine2 ?? undefined,
  postalCode: input.shippingAddress.postalCode ?? "N/A"
});

export const normalizeShippingMethodCode = (value?: string | null) =>
  value?.trim() ? value.trim().toUpperCase() : "STANDARD";

export const buildCheckoutIdempotencyKey = (prefix: string) => `${prefix}_${randomUUID()}`;
