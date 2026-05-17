import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { customerApi, type CustomerHomepagePayload } from "@/lib/api/customer";
import { CommerceApiError } from "@/lib/api/commerce-fetch";
import { classifyHomepageError } from "@/pages/storefront";

const homepageEntity: CustomerHomepagePayload = {
  hero: {
    eyebrow: "Featured",
    titlePrefix: "Fresh edit",
    titleAccent: null,
    titleSuffix: null,
    body: "Latest published homepage copy.",
    primaryCtaLabel: "Shop now",
    primaryCtaHref: "/shop",
    backgroundImageUrl: "https://cdn.example.com/hero.jpg",
    backgroundImageAlt: "Hero image"
  },
  trustBadges: [],
  categorySection: {
    isVisible: false,
    eyebrow: "Categories",
    title: "Shop categories",
    description: "Browse by category.",
    ctaLabel: null,
    ctaHref: null,
    items: []
  },
  featuredSection: {
    isVisible: false,
    eyebrow: "Featured",
    title: "Featured",
    description: "Highlights",
    ctaLabel: null,
    ctaHref: null,
    items: []
  },
  brandSection: {
    isVisible: false,
    eyebrow: "Brands",
    title: "Brands",
    description: "Brand spotlight",
    ctaLabel: null,
    ctaHref: null,
    items: []
  },
  campaignSection: {
    isVisible: false,
    eyebrow: "Campaigns",
    title: "Campaigns",
    description: "Current campaigns",
    ctaLabel: null,
    ctaHref: null,
    items: []
  },
  promoSection: {
    isVisible: false,
    eyebrow: "Promotions",
    title: "Promotions",
    description: "Current offers",
    items: []
  },
  testimonialSection: {
    isVisible: false,
    eyebrow: "Testimonials",
    title: "Testimonials",
    description: "Customer quotes",
    items: []
  }
};

const createMockResponse = (input: {
  status: number;
  body: string;
  contentType?: string;
}) =>
  ({
    ok: input.status >= 200 && input.status < 300,
    status: input.status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? (input.contentType ?? null) : null
    },
    text: vi.fn().mockResolvedValue(input.body)
  }) as unknown as Response;

describe("homepage loading", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("loads the published homepage from the shared commerce fetch client", async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          success: true,
          data: {
            entity: homepageEntity,
            meta: {
              publishedAt: "2026-05-17T12:00:00.000Z",
              updatedAt: "2026-05-17T12:00:00.000Z"
            }
          }
        })
      })
    );

    const result = await customerApi.getHomepage();

    expect(result.entity).toEqual(homepageEntity);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies an unpublished homepage as unpublished", async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        status: 404,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "The homepage is not currently published."
          }
        })
      })
    );

    await expect(customerApi.getHomepage()).rejects.toMatchObject({
      name: "CommerceApiError",
      status: 404,
      code: "NOT_FOUND"
    });

    expect(
      classifyHomepageError(
        new CommerceApiError("The homepage is not currently published.", 404, "NOT_FOUND", null, null)
      )
    ).toBe("unpublished");
  });

  it("classifies an HTML 503 homepage response as backend unavailable", async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        status: 503,
        contentType: "text/html; charset=utf-8",
        body: "<html><body>Service Suspended</body></html>"
      })
    );

    await expect(customerApi.getHomepage()).rejects.toMatchObject({
      name: "CommerceApiError",
      status: 503,
      code: "NON_JSON_RESPONSE"
    });

    expect(
      classifyHomepageError(
        new CommerceApiError("API returned a non-JSON response.", 503, "NON_JSON_RESPONSE", null, null)
      )
    ).toBe("unavailable");
  });

  it("treats a non-JSON 404 response as backend unavailable instead of unpublished", () => {
    expect(
      classifyHomepageError(
        new CommerceApiError("API returned a non-JSON response.", 404, "NON_JSON_RESPONSE", null, null)
      )
    ).toBe("unavailable");
  });
});
