import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCheckoutAddress,
  buildNormalizedStorefrontQuery,
  normalizeShippingMethodCode,
  normalizeStorefrontSort
} from "../modules/storefront-compat/storefront-compat.helpers";

test("normalizeStorefrontSort maps shorthand sort values", () => {
  assert.deepEqual(
    normalizeStorefrontSort({
      sort: "newest"
    }),
    {
      sortBy: "createdAt",
      sortOrder: "desc"
    }
  );

  assert.deepEqual(
    normalizeStorefrontSort({
      sort: "title_asc"
    }),
    {
      sortBy: "title",
      sortOrder: "asc"
    }
  );
});

test("buildNormalizedStorefrontQuery preserves mobile filter fields", () => {
  assert.deepEqual(
    buildNormalizedStorefrontQuery({
      page: 2,
      limit: 12,
      query: "sneaker",
      categoryId: "cat-id",
      brandId: "brand-id",
      minPrice: 1000,
      maxPrice: 5000,
      rating: 4,
      availability: "low_stock",
      sort: "oldest"
    }),
    {
      page: 2,
      page_size: 12,
      q: "sneaker",
      categoryId: "cat-id",
      brandId: "brand-id",
      minPrice: 1000,
      maxPrice: 5000,
      rating: 4,
      availability: "low_stock",
      sortBy: "createdAt",
      sortOrder: "asc"
    }
  );
});

test("buildCheckoutAddress merges contact and shipping payloads into checkout format", () => {
  assert.deepEqual(
    buildCheckoutAddress({
      contact: {
        email: "user@example.com",
        phone: "+233500000000"
      },
      shippingAddress: {
        fullName: "Edward Nyame",
        country: "Ghana",
        region: "Greater Accra",
        city: "Accra",
        addressLine1: "1 Ring Road",
        addressLine2: null,
        postalCode: null
      }
    }),
    {
      fullName: "Edward Nyame",
      email: "user@example.com",
      phone: "+233500000000",
      country: "Ghana",
      region: "Greater Accra",
      city: "Accra",
      line1: "1 Ring Road",
      line2: undefined,
      postalCode: "N/A"
    }
  );
});

test("normalizeShippingMethodCode uppercases known method identifiers and falls back safely", () => {
  assert.equal(normalizeShippingMethodCode("standard"), "STANDARD");
  assert.equal(normalizeShippingMethodCode(undefined), "STANDARD");
});
