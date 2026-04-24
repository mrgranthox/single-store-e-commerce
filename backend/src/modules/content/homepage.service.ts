import {
  HomePageCampaignLayout,
  HomePageContentMode,
  HomePageSectionHeaderKind,
  HomePageVersionState,
  Prisma,
  ProductStatus,
  PromotionStatus,
  ReviewStatus
} from "@prisma/client";

import { badRequestError, conflictError, notFoundError } from "../../common/errors/app-error";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { prisma } from "../../config/prisma";
import { listCatalogCategories, listPublicProductCardsByIds } from "../catalog/catalog.service";

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

type SectionHeaderKey =
  | "category"
  | "featured"
  | "brand"
  | "campaign"
  | "promo"
  | "testimonial";

type HomepageContentModeValue = "MANUAL" | "AUTO";

type SectionHeaderInput = {
  isVisible: boolean;
  contentMode: HomepageContentModeValue;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
};

type HomepageDraftInput = {
  hero: {
    eyebrow: string;
    titlePrefix: string;
    titleAccent?: string | null;
    titleSuffix?: string | null;
    body: string;
    primaryCtaLabel: string;
    primaryCtaHref: string | null;
    backgroundImageUrl: string;
    backgroundImageAlt?: string | null;
  };
  sectionHeaders: Record<SectionHeaderKey, SectionHeaderInput>;
  trustBadges: Array<{
    iconName: string;
    title: string;
    subtitle: string;
    href?: string | null;
    ariaLabel?: string | null;
  }>;
  categoryTiles: Array<{
    categoryId?: string | null;
    slug: string;
    title: string;
    description: string;
    imageUrl: string;
  }>;
  featuredProducts: Array<{
    productId: string;
  }>;
  brandSpotlights: Array<{
    brandId?: string | null;
    slug: string;
    title: string;
    tagline: string;
    heroImageUrl: string;
    ctaLabel: string;
    productIds: string[];
  }>;
  campaignSpotlights: Array<{
    campaignId?: string | null;
    slug: string;
    title: string;
    subtitle: string;
    heroImageUrl: string;
    label: string;
    ctaLabel: string;
    layout: "FEATURE" | "SPLIT";
    productIds: string[];
  }>;
  promoOffers: Array<{
    badge: string;
    code: string;
    headline: string;
    body: string;
    terms: string;
    bannerImageUrl: string;
    ctaLabel: string;
    ctaHref: string | null;
    productIds: string[];
  }>;
  testimonials: Array<{
    quote: string;
    customerName: string;
    imageUrl: string;
    statusLabel?: string | null;
  }>;
};

type HomepageWarning = string;

type PublishedHomepageSnapshot = HomepageDraftInput;

const headerKindByKey: Record<SectionHeaderKey, HomePageSectionHeaderKind> = {
  category: HomePageSectionHeaderKind.CATEGORY,
  featured: HomePageSectionHeaderKind.FEATURED,
  brand: HomePageSectionHeaderKind.BRAND,
  campaign: HomePageSectionHeaderKind.CAMPAIGN,
  promo: HomePageSectionHeaderKind.PROMO,
  testimonial: HomePageSectionHeaderKind.TESTIMONIAL
};

const headerKeyByKind = Object.fromEntries(
  Object.entries(headerKindByKey).map(([key, value]) => [value, key])
) as Record<HomePageSectionHeaderKind, SectionHeaderKey>;

const homepageVersionInclude = {
  hero: true,
  sectionHeaders: {
    orderBy: {
      kind: "asc" as const
    }
  },
  trustBadges: {
    orderBy: {
      sortOrder: "asc" as const
    }
  },
  categoryTiles: {
    orderBy: {
      sortOrder: "asc" as const
    }
  },
  featuredProducts: {
    orderBy: {
      sortOrder: "asc" as const
    }
  },
  brandSpotlights: {
    orderBy: {
      sortOrder: "asc" as const
    },
    include: {
      products: {
        orderBy: {
          sortOrder: "asc" as const
        }
      }
    }
  },
  campaignSpotlights: {
    orderBy: {
      sortOrder: "asc" as const
    },
    include: {
      products: {
        orderBy: {
          sortOrder: "asc" as const
        }
      }
    }
  },
  promoOffers: {
    orderBy: {
      sortOrder: "asc" as const
    },
    include: {
      products: {
        orderBy: {
          sortOrder: "asc" as const
        }
      }
    }
  },
  testimonials: {
    orderBy: {
      sortOrder: "asc" as const
    }
  }
} satisfies Prisma.HomePageVersionInclude;

type HomePageVersionRecord = Prisma.HomePageVersionGetPayload<{
  include: typeof homepageVersionInclude;
}>;

const homepageProductCandidateInclude = {
  brand: {
    select: {
      id: true,
      slug: true,
      name: true
    }
  },
  categories: {
    include: {
      category: true
    }
  },
  media: {
    orderBy: {
      sortOrder: "asc" as const
    }
  },
  variants: {
    where: {
      status: "ACTIVE"
    },
    orderBy: {
      id: "asc" as const
    },
    include: {
      media: {
        orderBy: {
          sortOrder: "asc" as const
        }
      },
      inventoryStocks: true
    }
  },
  reviews: {
    where: {
      status: ReviewStatus.PUBLISHED
    },
    select: {
      rating: true
    }
  }
} satisfies Prisma.ProductInclude;

type HomepageProductCandidate = Prisma.ProductGetPayload<{
  include: typeof homepageProductCandidateInclude;
}>;

type HomepageBannerShape = {
  id: string;
  placement: string;
  title: string | null;
  mediaUrl: string | null;
  linkUrl: string | null;
};

const HOMEPAGE_TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 20_000
};

const HOMEPAGE_HERO_FALLBACK_BODY =
  "Hero content is currently sourced from the published hero banner. Update the headline and copy in admin to finish the storefront edit.";

const bannerPlacementAllowlist = new Set(["hero", "home_hero", "home"]);

const blankHeroDraft: HomepageDraftInput["hero"] = {
  eyebrow: "Homepage",
  titlePrefix: "",
  titleAccent: null,
  titleSuffix: null,
  body: "",
  primaryCtaLabel: "Shop now",
  primaryCtaHref: "/shop",
  backgroundImageUrl: "",
  backgroundImageAlt: null
};

const defaultSectionHeaders: Record<SectionHeaderKey, SectionHeaderInput> = {
  category: {
    isVisible: true,
    contentMode: "AUTO",
    eyebrow: "Categories",
    title: "Shop Categories",
    description: "Browse the catalog by category.",
    ctaLabel: "Shop all",
    ctaHref: "/shop"
  },
  featured: {
    isVisible: true,
    contentMode: "AUTO",
    eyebrow: "Featured",
    title: "Featured Products",
    description: "Shop the products highlighted for the homepage.",
    ctaLabel: "Shop featured",
    ctaHref: "/shop"
  },
  brand: {
    isVisible: true,
    contentMode: "AUTO",
    eyebrow: "Brands",
    title: "Shop by Brand",
    description: "Explore the brands active in the catalog.",
    ctaLabel: "Browse brands",
    ctaHref: "/brands"
  },
  campaign: {
    isVisible: true,
    contentMode: "AUTO",
    eyebrow: "Campaigns",
    title: "Current Campaigns",
    description: "Explore the current campaign highlights.",
    ctaLabel: "View campaigns",
    ctaHref: "/shop"
  },
  promo: {
    isVisible: false,
    contentMode: "MANUAL",
    eyebrow: "Offers",
    title: "Promotions",
    description: "Promotions configured in the homepage CMS.",
    ctaLabel: null,
    ctaHref: null
  },
  testimonial: {
    isVisible: false,
    contentMode: "MANUAL",
    eyebrow: "Social proof",
    title: "Customer Feedback",
    description: "Verified customer testimonials shown on the homepage.",
    ctaLabel: null,
    ctaHref: null
  }
};

const mockHeroSignature = {
  eyebrow: "Storefront homepage",
  titlePrefix: "Color that",
  titleAccent: "performs",
  titleSuffix: ".",
  body: "Pigment-rich makeup, skin-first essentials, and fast-moving edits managed from the admin workspace.",
  primaryCtaLabel: "Shop the edit",
  primaryCtaHref: "/shop",
  backgroundImageMatch: "photo-1596462502278-27bfdc403348"
} as const;

const mockPromoSignatures = [
  {
    badge: "First purchase",
    code: "EDIT15",
    headline: "15% off your first full-price order"
  },
  {
    badge: "Pair & save",
    code: "LAYER20",
    headline: "Promote bundle-style pairings"
  }
] as const;

const mockTestimonialSignatures = [
  {
    customerName: "Eleanor Vance",
    quote:
      "\"The homepage now feels intentional. Promotions, products, and campaigns finally line up with what the team is actually selling this week.\""
  },
  {
    customerName: "Julian Archer",
    quote:
      "\"Support helped me pick the right bundle and the homepage offer matched exactly what I saw in checkout. That consistency matters.\""
  },
  {
    customerName: "Sasha Grey",
    quote:
      "\"The curated campaign block pulled me straight into the launch. It felt edited, not random.\""
  }
] as const;

const normalizeNullableText = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
};

const normalizeInternalHref = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || !trimmed.startsWith("/")) {
    return null;
  }

  return trimmed;
};

const uniqueIds = (values: string[]) => {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);
  }

  return output;
};

const cloneSectionHeaders = (headers: Record<SectionHeaderKey, SectionHeaderInput>) =>
  Object.fromEntries(
    (Object.keys(defaultSectionHeaders) as SectionHeaderKey[]).map((key) => [
      key,
      {
        ...headers[key]
      }
    ])
  ) as Record<SectionHeaderKey, SectionHeaderInput>;

const normalizeSectionHeaders = (headers?: Partial<Record<SectionHeaderKey, SectionHeaderInput>>) =>
  Object.fromEntries(
    (Object.keys(defaultSectionHeaders) as SectionHeaderKey[]).map((key) => {
      const current = headers?.[key];
      const fallback = defaultSectionHeaders[key];
      const contentMode =
        key === "promo" || key === "testimonial"
          ? "MANUAL"
          : current?.contentMode === "MANUAL"
            ? "MANUAL"
            : "AUTO";

      return [
        key,
        {
          isVisible: current?.isVisible ?? fallback.isVisible,
          contentMode,
          eyebrow: current?.eyebrow?.trim() || fallback.eyebrow,
          title: current?.title?.trim() || fallback.title,
          description: current?.description?.trim() || fallback.description,
          ctaLabel: normalizeNullableText(current?.ctaLabel) ?? fallback.ctaLabel ?? null,
          ctaHref: normalizeInternalHref(current?.ctaHref) ?? fallback.ctaHref ?? null
        } satisfies SectionHeaderInput
      ];
    })
  ) as Record<SectionHeaderKey, SectionHeaderInput>;

const normalizeDraftInput = (draft: HomepageDraftInput): HomepageDraftInput => ({
  hero: {
    eyebrow: draft.hero.eyebrow.trim(),
    titlePrefix: draft.hero.titlePrefix.trim(),
    titleAccent: normalizeNullableText(draft.hero.titleAccent),
    titleSuffix: normalizeNullableText(draft.hero.titleSuffix),
    body: draft.hero.body.trim(),
    primaryCtaLabel: draft.hero.primaryCtaLabel.trim(),
    primaryCtaHref: normalizeInternalHref(draft.hero.primaryCtaHref) ?? "/shop",
    backgroundImageUrl: draft.hero.backgroundImageUrl.trim(),
    backgroundImageAlt: normalizeNullableText(draft.hero.backgroundImageAlt)
  },
  sectionHeaders: normalizeSectionHeaders(draft.sectionHeaders),
  trustBadges: draft.trustBadges.map((item) => ({
    iconName: item.iconName.trim(),
    title: item.title.trim(),
    subtitle: item.subtitle.trim(),
    href: normalizeInternalHref(item.href),
    ariaLabel: normalizeNullableText(item.ariaLabel)
  })),
  categoryTiles: draft.categoryTiles.map((item) => ({
    categoryId: item.categoryId ?? null,
    slug: item.slug.trim(),
    title: item.title.trim(),
    description: item.description.trim(),
    imageUrl: item.imageUrl.trim()
  })),
  featuredProducts: uniqueIds(draft.featuredProducts.map((item) => item.productId)).map((productId) => ({
    productId
  })),
  brandSpotlights: draft.brandSpotlights.map((item) => ({
    brandId: item.brandId ?? null,
    slug: item.slug.trim(),
    title: item.title.trim(),
    tagline: item.tagline.trim(),
    heroImageUrl: item.heroImageUrl.trim(),
    ctaLabel: item.ctaLabel.trim(),
    productIds: uniqueIds(item.productIds)
  })),
  campaignSpotlights: draft.campaignSpotlights.map((item) => ({
    campaignId: item.campaignId ?? null,
    slug: item.slug.trim(),
    title: item.title.trim(),
    subtitle: item.subtitle.trim(),
    heroImageUrl: item.heroImageUrl.trim(),
    label: item.label.trim(),
    ctaLabel: item.ctaLabel.trim(),
    layout: item.layout,
    productIds: uniqueIds(item.productIds)
  })),
  promoOffers: draft.promoOffers.map((item) => ({
    badge: item.badge.trim(),
    code: item.code.trim(),
    headline: item.headline.trim(),
    body: item.body.trim(),
    terms: item.terms.trim(),
    bannerImageUrl: item.bannerImageUrl.trim(),
    ctaLabel: item.ctaLabel.trim(),
    ctaHref: normalizeInternalHref(item.ctaHref) ?? "/shop",
    productIds: uniqueIds(item.productIds)
  })),
  testimonials: draft.testimonials.map((item) => ({
    quote: item.quote.trim(),
    customerName: item.customerName.trim(),
    imageUrl: item.imageUrl.trim(),
    statusLabel: normalizeNullableText(item.statusLabel) ?? "Verified purchase"
  }))
});

const buildInitialHomepageDraft = (banner: HomepageBannerShape | null): HomepageDraftInput => ({
  hero: banner ? buildBannerFallbackHero(banner) : { ...blankHeroDraft },
  sectionHeaders: cloneSectionHeaders(defaultSectionHeaders),
  trustBadges: [],
  categoryTiles: [],
  featuredProducts: [],
  brandSpotlights: [],
  campaignSpotlights: [],
  promoOffers: [],
  testimonials: []
});

const isMockHero = (hero: HomepageDraftInput["hero"]) =>
  hero.eyebrow === mockHeroSignature.eyebrow &&
  hero.titlePrefix === mockHeroSignature.titlePrefix &&
  (hero.titleAccent ?? null) === mockHeroSignature.titleAccent &&
  (hero.titleSuffix ?? null) === mockHeroSignature.titleSuffix &&
  hero.body === mockHeroSignature.body &&
  hero.primaryCtaLabel === mockHeroSignature.primaryCtaLabel &&
  hero.primaryCtaHref === mockHeroSignature.primaryCtaHref &&
  hero.backgroundImageUrl.includes(mockHeroSignature.backgroundImageMatch);

const hasMockPromoOffers = (promoOffers: HomepageDraftInput["promoOffers"]) =>
  promoOffers.length === mockPromoSignatures.length &&
  promoOffers.every((item, index) => {
    const signature = mockPromoSignatures[index]!;
    return item.badge === signature.badge && item.code === signature.code && item.headline === signature.headline;
  });

const hasMockTestimonials = (testimonials: HomepageDraftInput["testimonials"]) =>
  testimonials.length === mockTestimonialSignatures.length &&
  testimonials.every((item, index) => {
    const signature = mockTestimonialSignatures[index]!;
    return item.customerName === signature.customerName && item.quote === signature.quote;
  });

const buildBannerFallbackHero = (banner: HomepageBannerShape): HomepageDraftInput["hero"] => ({
  eyebrow: "Homepage banner",
  titlePrefix: banner.title?.trim() || "Shop the latest drop",
  titleAccent: null,
  titleSuffix: null,
  body: HOMEPAGE_HERO_FALLBACK_BODY,
  primaryCtaLabel: normalizeInternalHref(banner.linkUrl) ? "Shop banner" : "Shop now",
  primaryCtaHref: normalizeInternalHref(banner.linkUrl) ?? "/shop",
  backgroundImageUrl: banner.mediaUrl?.trim() ?? "",
  backgroundImageAlt: banner.title?.trim() || "Published homepage hero banner"
});

const isBannerFallbackHero = (hero: HomepageDraftInput["hero"], banner: HomepageBannerShape | null) =>
  Boolean(
    banner &&
      banner.mediaUrl &&
      hero.body === HOMEPAGE_HERO_FALLBACK_BODY &&
      hero.backgroundImageUrl === banner.mediaUrl &&
      hero.primaryCtaHref === (normalizeInternalHref(banner.linkUrl) ?? "/shop")
  );

const readSectionHeaders = (record: HomePageVersionRecord["sectionHeaders"]) => {
  const entries = Object.fromEntries(
    record.map((header) => [
      headerKeyByKind[header.kind],
      {
        isVisible: header.isVisible,
        contentMode: header.contentMode === HomePageContentMode.AUTO ? "AUTO" : "MANUAL",
        eyebrow: header.eyebrow,
        title: header.title,
        description: header.description,
        ctaLabel: header.ctaLabel,
        ctaHref: header.ctaHref
      }
    ])
  ) as Partial<Record<SectionHeaderKey, SectionHeaderInput>>;

  return normalizeSectionHeaders(entries);
};

const extractDraftInput = (record: HomePageVersionRecord): HomepageDraftInput => ({
  hero: {
    eyebrow: record.hero?.eyebrow ?? blankHeroDraft.eyebrow,
    titlePrefix: record.hero?.titlePrefix ?? blankHeroDraft.titlePrefix,
    titleAccent: record.hero?.titleAccent ?? blankHeroDraft.titleAccent,
    titleSuffix: record.hero?.titleSuffix ?? blankHeroDraft.titleSuffix,
    body: record.hero?.body ?? blankHeroDraft.body,
    primaryCtaLabel: record.hero?.primaryCtaLabel ?? blankHeroDraft.primaryCtaLabel,
    primaryCtaHref: record.hero?.primaryCtaHref ?? blankHeroDraft.primaryCtaHref,
    backgroundImageUrl: record.hero?.backgroundImageUrl ?? blankHeroDraft.backgroundImageUrl,
    backgroundImageAlt: record.hero?.backgroundImageAlt ?? blankHeroDraft.backgroundImageAlt
  },
  sectionHeaders: readSectionHeaders(record.sectionHeaders),
  trustBadges: record.trustBadges.map((item) => ({
    iconName: item.iconName,
    title: item.title,
    subtitle: item.subtitle,
    href: item.href,
    ariaLabel: item.ariaLabel
  })),
  categoryTiles: record.categoryTiles.map((item) => ({
    categoryId: item.categoryId,
    slug: item.slug,
    title: item.title,
    description: item.description,
    imageUrl: item.imageUrl
  })),
  featuredProducts: record.featuredProducts.map((item) => ({
    productId: item.productId
  })),
  brandSpotlights: record.brandSpotlights.map((item) => ({
    brandId: item.brandId,
    slug: item.slug,
    title: item.title,
    tagline: item.tagline,
    heroImageUrl: item.heroImageUrl,
    ctaLabel: item.ctaLabel,
    productIds: item.products.map((product) => product.productId)
  })),
  campaignSpotlights: record.campaignSpotlights.map((item) => ({
    campaignId: item.campaignId,
    slug: item.slug,
    title: item.title,
    subtitle: item.subtitle,
    heroImageUrl: item.heroImageUrl,
    label: item.label,
    ctaLabel: item.ctaLabel,
    layout: item.layout === HomePageCampaignLayout.FEATURE ? "FEATURE" : "SPLIT",
    productIds: item.products.map((product) => product.productId)
  })),
  promoOffers: record.promoOffers.map((item) => ({
    badge: item.badge,
    code: item.code,
    headline: item.headline,
    body: item.body,
    terms: item.terms,
    bannerImageUrl: item.bannerImageUrl,
    ctaLabel: item.ctaLabel,
    ctaHref: item.ctaHref,
    productIds: item.products.map((product) => product.productId)
  })),
  testimonials: record.testimonials.map((item) => ({
    quote: item.quote,
    customerName: item.customerName,
    imageUrl: item.imageUrl,
    statusLabel: item.statusLabel
  }))
});

const serializeDraftEntity = (record: HomePageVersionRecord, publishedAt: string | null) => ({
  status: {
    hasPublishedVersion: Boolean(publishedAt),
    draftUpdatedAt: record.updatedAt.toISOString(),
    publishedAt
  },
  ...extractDraftInput(record)
});

const getVersion = async (db: DatabaseClient, state: HomePageVersionState) =>
  db.homePageVersion.findUnique({
    where: {
      state
    },
    include: homepageVersionInclude
  });

const findPrimaryHomepageBanner = async (db: DatabaseClient): Promise<HomepageBannerShape | null> => {
  const banners = await db.banner.findMany({
    where: {
      status: "PUBLISHED",
      mediaUrl: {
        not: null
      }
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 20,
    select: {
      id: true,
      placement: true,
      title: true,
      mediaUrl: true,
      linkUrl: true
    }
  });

  return (
    banners.find((banner) => bannerPlacementAllowlist.has(banner.placement.trim().toLowerCase())) ??
    banners[0] ??
    null
  );
};

const touchVersion = async (transaction: Prisma.TransactionClient, versionId: string) => {
  await transaction.$executeRaw`
    UPDATE "HomePageVersion"
    SET "updatedAt" = NOW()
    WHERE "id" = ${versionId}
  `;
};

async function writeVersionContent(
  transaction: Prisma.TransactionClient,
  versionId: string,
  input: HomepageDraftInput
) {
  await transaction.homePageHero.upsert({
    where: {
      versionId
    },
    create: {
      versionId,
      eyebrow: input.hero.eyebrow,
      titlePrefix: input.hero.titlePrefix,
      titleAccent: input.hero.titleAccent ?? null,
      titleSuffix: input.hero.titleSuffix ?? null,
      body: input.hero.body,
      primaryCtaLabel: input.hero.primaryCtaLabel,
      primaryCtaHref: input.hero.primaryCtaHref ?? "/shop",
      backgroundImageUrl: input.hero.backgroundImageUrl,
      backgroundImageAlt: input.hero.backgroundImageAlt ?? null
    },
    update: {
      eyebrow: input.hero.eyebrow,
      titlePrefix: input.hero.titlePrefix,
      titleAccent: input.hero.titleAccent ?? null,
      titleSuffix: input.hero.titleSuffix ?? null,
      body: input.hero.body,
      primaryCtaLabel: input.hero.primaryCtaLabel,
      primaryCtaHref: input.hero.primaryCtaHref ?? "/shop",
      backgroundImageUrl: input.hero.backgroundImageUrl,
      backgroundImageAlt: input.hero.backgroundImageAlt ?? null
    }
  });

  await transaction.homePageSectionHeader.deleteMany({
    where: {
      versionId
    }
  });

  await transaction.homePageSectionHeader.createMany({
    data: (Object.entries(input.sectionHeaders) as Array<[SectionHeaderKey, SectionHeaderInput]>).map(
      ([key, section]) => ({
        versionId,
        kind: headerKindByKey[key],
        isVisible: section.isVisible,
        contentMode:
          section.contentMode === "AUTO" ? HomePageContentMode.AUTO : HomePageContentMode.MANUAL,
        eyebrow: section.eyebrow,
        title: section.title,
        description: section.description,
        ctaLabel: section.ctaLabel ?? null,
        ctaHref: section.ctaHref ?? null
      })
    )
  });

  await transaction.homePageTrustBadge.deleteMany({
    where: {
      versionId
    }
  });
  if (input.trustBadges.length > 0) {
    await transaction.homePageTrustBadge.createMany({
      data: input.trustBadges.map((item, index) => ({
        versionId,
        sortOrder: index,
        iconName: item.iconName,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href ?? null,
        ariaLabel: item.ariaLabel ?? null
      }))
    });
  }

  await transaction.homePageCategoryTile.deleteMany({
    where: {
      versionId
    }
  });
  if (input.categoryTiles.length > 0) {
    await transaction.homePageCategoryTile.createMany({
      data: input.categoryTiles.map((item, index) => ({
        versionId,
        categoryId: item.categoryId ?? null,
        sortOrder: index,
        slug: item.slug,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl
      }))
    });
  }

  await transaction.homePageFeaturedProduct.deleteMany({
    where: {
      versionId
    }
  });
  if (input.featuredProducts.length > 0) {
    await transaction.homePageFeaturedProduct.createMany({
      data: input.featuredProducts.map((item, index) => ({
        versionId,
        productId: item.productId,
        sortOrder: index
      }))
    });
  }

  await transaction.homePageBrandSpotlight.deleteMany({
    where: {
      versionId
    }
  });
  for (const [index, spotlight] of input.brandSpotlights.entries()) {
    const created = await transaction.homePageBrandSpotlight.create({
      data: {
        versionId,
        brandId: spotlight.brandId ?? null,
        sortOrder: index,
        slug: spotlight.slug,
        title: spotlight.title,
        tagline: spotlight.tagline,
        heroImageUrl: spotlight.heroImageUrl,
        ctaLabel: spotlight.ctaLabel
      }
    });

    if (spotlight.productIds.length > 0) {
      await transaction.homePageBrandSpotlightProduct.createMany({
        data: spotlight.productIds.map((productId, productIndex) => ({
          brandSpotlightId: created.id,
          productId,
          sortOrder: productIndex
        }))
      });
    }
  }

  await transaction.homePageCampaignSpotlight.deleteMany({
    where: {
      versionId
    }
  });
  for (const [index, spotlight] of input.campaignSpotlights.entries()) {
    const created = await transaction.homePageCampaignSpotlight.create({
      data: {
        versionId,
        campaignId: spotlight.campaignId ?? null,
        sortOrder: index,
        slug: spotlight.slug,
        title: spotlight.title,
        subtitle: spotlight.subtitle,
        heroImageUrl: spotlight.heroImageUrl,
        label: spotlight.label,
        ctaLabel: spotlight.ctaLabel,
        layout:
          spotlight.layout === "FEATURE"
            ? HomePageCampaignLayout.FEATURE
            : HomePageCampaignLayout.SPLIT
      }
    });

    if (spotlight.productIds.length > 0) {
      await transaction.homePageCampaignSpotlightProduct.createMany({
        data: spotlight.productIds.map((productId, productIndex) => ({
          campaignSpotlightId: created.id,
          productId,
          sortOrder: productIndex
        }))
      });
    }
  }

  await transaction.homePagePromoOffer.deleteMany({
    where: {
      versionId
    }
  });
  for (const [index, promo] of input.promoOffers.entries()) {
    const created = await transaction.homePagePromoOffer.create({
      data: {
        versionId,
        sortOrder: index,
        badge: promo.badge,
        code: promo.code,
        headline: promo.headline,
        body: promo.body,
        terms: promo.terms,
        bannerImageUrl: promo.bannerImageUrl,
        ctaLabel: promo.ctaLabel,
        ctaHref: promo.ctaHref ?? "/shop"
      }
    });

    if (promo.productIds.length > 0) {
      await transaction.homePagePromoOfferProduct.createMany({
        data: promo.productIds.map((productId, productIndex) => ({
          promoOfferId: created.id,
          productId,
          sortOrder: productIndex
        }))
      });
    }
  }

  await transaction.homePageTestimonial.deleteMany({
    where: {
      versionId
    }
  });
  if (input.testimonials.length > 0) {
    await transaction.homePageTestimonial.createMany({
      data: input.testimonials.map((item, index) => ({
        versionId,
        sortOrder: index,
        quote: item.quote,
        customerName: item.customerName,
        imageUrl: item.imageUrl,
        statusLabel: item.statusLabel ?? "Verified purchase"
      }))
    });
  }

  await touchVersion(transaction, versionId);
}

const recordHomepageMutation = async (
  transaction: Prisma.TransactionClient,
  input: {
    actorAdminUserId: string;
    actionCode: string;
    before?: unknown;
    after?: unknown;
  }
) => {
  await Promise.all([
    transaction.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorAdminUserId: input.actorAdminUserId,
        actionCode: input.actionCode,
        entityType: "HOMEPAGE",
        entityId: "homepage",
        metadata: toPrismaJsonValue({
          before: input.before,
          after: input.after
        })
      }
    }),
    transaction.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        screen: "content.homepage",
        actionCode: input.actionCode,
        entityType: "HOMEPAGE",
        entityId: "homepage",
        before: toPrismaJsonValue(input.before),
        after: toPrismaJsonValue(input.after)
      }
    }),
    transaction.timelineEvent.create({
      data: {
        entityType: "HOMEPAGE",
        entityId: "homepage",
        eventType: input.actionCode.toUpperCase().replaceAll(".", "_"),
        actorAdminUserId: input.actorAdminUserId,
        actorType: "ADMIN",
        payload: toPrismaJsonValue({
          before: input.before,
          after: input.after
        })
      }
    })
  ]);
};

const deriveAvailableQuantity = (product: HomepageProductCandidate, variantId: string) => {
  const variant = product.variants.find((entry) => entry.id === variantId);
  if (!variant) {
    return 0;
  }

  return variant.inventoryStocks.reduce((total, stock) => total + stock.onHand - stock.reserved, 0);
};

const selectCandidatePrimaryMedia = (product: HomepageProductCandidate) =>
  product.media[0]?.url ??
  product.variants.flatMap((variant) => variant.media).find((media) => Boolean(media.url))?.url ??
  null;

const selectHomepagePurchasableVariant = (product: HomepageProductCandidate) =>
  product.variants.find(
    (variant) =>
      variant.priceAmountCents != null &&
      variant.priceCurrency &&
      deriveAvailableQuantity(product, variant.id) > 0
  ) ?? null;

const isHomepageProductCandidateEligible = (product: HomepageProductCandidate) =>
  Boolean(selectCandidatePrimaryMedia(product) && selectHomepagePurchasableVariant(product));

const loadHomepageProductCandidates = async (
  db: DatabaseClient,
  input: {
    where?: Prisma.ProductWhereInput;
    take?: number;
    orderBy?: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[];
  } = {}
) =>
  (await db.product.findMany({
    where: {
      status: ProductStatus.PUBLISHED,
      ...input.where
    },
    include: homepageProductCandidateInclude,
    orderBy: input.orderBy ?? [{ updatedAt: "desc" }],
    take: input.take
  })) as HomepageProductCandidate[];

const sanitizeProductIds = async (
  db: DatabaseClient,
  productIds: string[],
  input: {
    limit: number;
    warningPrefix: string;
    warnings: HomepageWarning[];
  }
) => {
  const orderedIds = uniqueIds(productIds);
  if (orderedIds.length === 0) {
    return [];
  }

  const candidates = await loadHomepageProductCandidates(db, {
    where: {
      id: {
        in: orderedIds
      }
    }
  });

  const candidateMap = new Map(candidates.map((product) => [product.id, product]));
  const eligibleIds = orderedIds.filter((productId) => {
    const candidate = candidateMap.get(productId);
    return Boolean(candidate && isHomepageProductCandidateEligible(candidate));
  });

  if (eligibleIds.length < orderedIds.length) {
    input.warnings.push(
      `${input.warningPrefix} removed ${orderedIds.length - eligibleIds.length} product selection${orderedIds.length - eligibleIds.length === 1 ? "" : "s"} that no longer have real media or a purchasable variant.`
    );
  }

  return eligibleIds.slice(0, input.limit);
};

const resolveAutoFeaturedProducts = async (db: DatabaseClient) => {
  const candidates = await loadHomepageProductCandidates(db, {
    orderBy: [
      { merchandisingHomeHighlight: "desc" },
      { merchandisingFeatured: "desc" },
      { updatedAt: "desc" }
    ],
    take: 120
  });

  return candidates.filter(isHomepageProductCandidateEligible).slice(0, 10).map((product) => ({
    productId: product.id
  }));
};

const resolveAutoCategoryTiles = async (db: DatabaseClient) => {
  const [categories, recentProducts] = await Promise.all([
    db.category.findMany({
      where: {
        status: "ACTIVE"
      },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    }),
    loadHomepageProductCandidates(db, {
      orderBy: [{ updatedAt: "desc" }],
      take: 120
    })
  ]);

  const imageByCategoryId = new Map<string, string>();
  for (const product of recentProducts.filter(isHomepageProductCandidateEligible)) {
    const imageUrl = selectCandidatePrimaryMedia(product);
    if (!imageUrl) {
      continue;
    }

    for (const entry of product.categories) {
      if (!imageByCategoryId.has(entry.category.id)) {
        imageByCategoryId.set(entry.category.id, imageUrl);
      }
    }
  }

  return categories
    .filter((category) => category._count.products > 0)
    .sort((left, right) => {
      if (right._count.products !== left._count.products) {
        return right._count.products - left._count.products;
      }

      return left.name.localeCompare(right.name);
    })
    .map((category) => {
      const imageUrl = category.imageUrl ?? imageByCategoryId.get(category.id) ?? null;
      if (!imageUrl) {
        return null;
      }

      return {
        categoryId: category.id,
        slug: category.slug,
        title: category.name,
        description:
          category._count.products === 1
            ? "1 published product"
            : `${category._count.products} published products`,
        imageUrl
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 3);
};

const resolveAutoBrandSpotlights = async (db: DatabaseClient) => {
  const products = (await loadHomepageProductCandidates(db, {
    where: {
      brandId: {
        not: null
      }
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 120
  })).filter(isHomepageProductCandidateEligible);

  const productIdsByBrandId = new Map<string, string[]>();
  const latestUpdatedAtByBrandId = new Map<string, Date>();
  const fallbackImageByBrandId = new Map<string, string>();

  for (const product of products) {
    if (!product.brandId) {
      continue;
    }

    const current = productIdsByBrandId.get(product.brandId) ?? [];
    current.push(product.id);
    productIdsByBrandId.set(product.brandId, current);

    if (!latestUpdatedAtByBrandId.has(product.brandId)) {
      latestUpdatedAtByBrandId.set(product.brandId, product.updatedAt);
    }

    const imageUrl = selectCandidatePrimaryMedia(product);
    if (imageUrl && !fallbackImageByBrandId.has(product.brandId)) {
      fallbackImageByBrandId.set(product.brandId, imageUrl);
    }
  }

  const brands = await db.brand.findMany({
    where: {
      status: "ACTIVE",
      id: {
        in: [...productIdsByBrandId.keys()]
      }
    },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      galleryImageUrls: true,
      linkedBanner: {
        select: {
          mediaUrl: true
        }
      }
    }
  });

  return brands
    .map((brand) => {
      const productIds = (productIdsByBrandId.get(brand.id) ?? []).slice(0, 3);
      const heroImageUrl =
        brand.logoUrl ??
        brand.galleryImageUrls[0] ??
        brand.linkedBanner?.mediaUrl ??
        fallbackImageByBrandId.get(brand.id) ??
        null;
      const latestUpdatedAt = latestUpdatedAtByBrandId.get(brand.id) ?? new Date(0);

      if (!heroImageUrl || productIds.length === 0) {
        return null;
      }

      return {
        latestUpdatedAt,
        item: {
          brandId: brand.id,
          slug: brand.slug,
          title: brand.name,
          tagline: `Shop ${brand.name} from the storefront homepage.`,
          heroImageUrl,
          ctaLabel: `Shop ${brand.name}`,
          productIds
        }
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => {
      const delta = right.latestUpdatedAt.getTime() - left.latestUpdatedAt.getTime();
      if (delta !== 0) {
        return delta;
      }

      return left.item.title.localeCompare(right.item.title);
    })
    .slice(0, 3)
    .map((entry) => entry.item);
};

const resolveAutoCampaignSpotlights = async (db: DatabaseClient) => {
  const campaigns = await db.campaign.findMany({
    where: {
      status: PromotionStatus.ACTIVE
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 8,
    include: {
      banners: {
        where: {
          status: "PUBLISHED",
          mediaUrl: {
            not: null
          }
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: 1
      }
    }
  });

  return campaigns
    .map((campaign, index) => {
      const banner = campaign.banners[0];
      if (!banner?.mediaUrl) {
        return null;
      }

      return {
        campaignId: campaign.id,
        slug: campaign.slug,
        title: campaign.name,
        subtitle: banner.title?.trim() || `Explore ${campaign.name}.`,
        heroImageUrl: banner.mediaUrl,
        label: "Campaign",
        ctaLabel: "View campaign",
        layout: index === 0 ? ("FEATURE" as const) : ("SPLIT" as const),
        productIds: [] as string[]
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 2);
};

const resolveHero = async (
  db: DatabaseClient,
  hero: HomepageDraftInput["hero"],
  warnings: HomepageWarning[]
) => {
  const banner = await findPrimaryHomepageBanner(db);
  if (isMockHero(hero) || !hero.backgroundImageUrl.trim()) {
    if (!banner?.mediaUrl) {
      warnings.push("Hero content is incomplete and there is no published hero banner to use as a fallback.");
      return hero;
    }

    warnings.push("Hero content is currently using the published HERO banner as a fallback. Replace it with editorial copy in admin.");
    return buildBannerFallbackHero(banner);
  }

  if (isBannerFallbackHero(hero, banner)) {
    warnings.push("Hero content is currently using the published HERO banner as a fallback. Replace it with editorial copy in admin.");
  }

  return hero;
};

const resolveSnapshotSectionHeader = (
  header: SectionHeaderInput,
  nextIsVisible: boolean
): SectionHeaderInput => ({
  ...header,
  isVisible: nextIsVisible,
  contentMode: "MANUAL"
});

const resolveHomepageSnapshot = async (
  db: DatabaseClient,
  draft: HomepageDraftInput
): Promise<{
  snapshot: PublishedHomepageSnapshot;
  warnings: HomepageWarning[];
}> => {
  const normalized = normalizeDraftInput(draft);
  const warnings: HomepageWarning[] = [];

  const resolvedHero = await resolveHero(db, normalized.hero, warnings);

  const categoryTiles =
    normalized.sectionHeaders.category.contentMode === "AUTO"
      ? await resolveAutoCategoryTiles(db)
      : normalized.categoryTiles
          .filter((item) => Boolean(item.slug && item.title && item.imageUrl))
          .slice(0, 3);
  if (normalized.sectionHeaders.category.isVisible && categoryTiles.length === 0) {
    warnings.push("Category section is configured to show on the storefront, but no real category cards could be resolved.");
  }

  const featuredProductIds =
    normalized.sectionHeaders.featured.contentMode === "AUTO"
      ? (await resolveAutoFeaturedProducts(db)).map((item) => item.productId)
      : await sanitizeProductIds(
          db,
          normalized.featuredProducts.map((item) => item.productId),
          {
            limit: 10,
            warningPrefix: "Featured section",
            warnings
          }
        );
  if (normalized.sectionHeaders.featured.isVisible && featuredProductIds.length === 0) {
    warnings.push("Featured section is configured to show on the storefront, but no real shoppable products could be resolved.");
  }

  const brandSpotlights =
    normalized.sectionHeaders.brand.contentMode === "AUTO"
      ? await resolveAutoBrandSpotlights(db)
      : (
          await Promise.all(
            normalized.brandSpotlights.slice(0, 3).map(async (item) => {
              const productIds = await sanitizeProductIds(db, item.productIds, {
                limit: 3,
                warningPrefix: `Brand spotlight "${item.title || item.slug || "Untitled"}"`,
                warnings
              });
              if (!item.slug || !item.title || !item.heroImageUrl || !item.ctaLabel) {
                return null;
              }

              return {
                ...item,
                productIds
              };
            })
          )
        ).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (normalized.sectionHeaders.brand.isVisible && brandSpotlights.length === 0) {
    warnings.push("Brand section is configured to show on the storefront, but no real brand spotlights could be resolved.");
  }

  const campaignSpotlights =
    normalized.sectionHeaders.campaign.contentMode === "AUTO"
      ? await resolveAutoCampaignSpotlights(db)
      : (
          await Promise.all(
            normalized.campaignSpotlights.slice(0, 2).map(async (item) => {
              const productIds = await sanitizeProductIds(db, item.productIds, {
                limit: 6,
                warningPrefix: `Campaign spotlight "${item.title || item.slug || "Untitled"}"`,
                warnings
              });
              if (!item.slug || !item.title || !item.heroImageUrl || !item.ctaLabel || !item.label) {
                return null;
              }

              return {
                ...item,
                productIds
              };
            })
          )
        ).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (normalized.sectionHeaders.campaign.isVisible && campaignSpotlights.length === 0) {
    warnings.push("Campaign section is configured to show on the storefront, but no real campaign banners could be resolved.");
  }

  const promoOffers = (
    await Promise.all(
      normalized.promoOffers.map(async (item) => ({
        ...item,
        productIds: await sanitizeProductIds(db, item.productIds, {
          limit: 6,
          warningPrefix: `Promo "${item.code || item.badge || "Untitled"}"`,
          warnings
        })
      }))
    )
  ).filter((item) => Boolean(item.badge && item.code && item.headline && item.bannerImageUrl));
  if (normalized.sectionHeaders.promo.isVisible && promoOffers.length === 0) {
    warnings.push("Promo section is visible in admin, but there are no real promo offers saved for publication.");
  }

  const testimonials = normalized.testimonials.filter((item) =>
    Boolean(item.customerName && item.quote && item.imageUrl)
  );
  if (normalized.sectionHeaders.testimonial.isVisible && testimonials.length === 0) {
    warnings.push("Testimonial section is visible in admin, but there are no real testimonials saved for publication.");
  }

  return {
    snapshot: {
      hero: resolvedHero,
      sectionHeaders: {
        category: resolveSnapshotSectionHeader(
          normalized.sectionHeaders.category,
          normalized.sectionHeaders.category.isVisible && categoryTiles.length > 0
        ),
        featured: resolveSnapshotSectionHeader(
          normalized.sectionHeaders.featured,
          normalized.sectionHeaders.featured.isVisible && featuredProductIds.length > 0
        ),
        brand: resolveSnapshotSectionHeader(
          normalized.sectionHeaders.brand,
          normalized.sectionHeaders.brand.isVisible && brandSpotlights.length > 0
        ),
        campaign: resolveSnapshotSectionHeader(
          normalized.sectionHeaders.campaign,
          normalized.sectionHeaders.campaign.isVisible && campaignSpotlights.length > 0
        ),
        promo: resolveSnapshotSectionHeader(
          normalized.sectionHeaders.promo,
          normalized.sectionHeaders.promo.isVisible && promoOffers.length > 0
        ),
        testimonial: resolveSnapshotSectionHeader(
          normalized.sectionHeaders.testimonial,
          normalized.sectionHeaders.testimonial.isVisible && testimonials.length > 0
        )
      },
      trustBadges: normalized.trustBadges,
      categoryTiles,
      featuredProducts: featuredProductIds.map((productId) => ({ productId })),
      brandSpotlights,
      campaignSpotlights,
      promoOffers,
      testimonials
    },
    warnings: Array.from(new Set(warnings))
  };
};

const assertPublishableHomepageSnapshot = (snapshot: PublishedHomepageSnapshot) => {
  if (
    !snapshot.hero.titlePrefix.trim() ||
    !snapshot.hero.body.trim() ||
    !snapshot.hero.primaryCtaLabel.trim() ||
    !snapshot.hero.primaryCtaHref?.trim() ||
    !snapshot.hero.primaryCtaHref?.startsWith("/") ||
    !snapshot.hero.backgroundImageUrl.trim()
  ) {
    throw badRequestError("Homepage hero is incomplete. Add a real hero or publish a usable HERO banner first.");
  }

  const hasConversionSection =
    (snapshot.sectionHeaders.featured.isVisible && snapshot.featuredProducts.length > 0) ||
    (snapshot.sectionHeaders.promo.isVisible && snapshot.promoOffers.length > 0) ||
    (snapshot.sectionHeaders.category.isVisible && snapshot.categoryTiles.length > 0) ||
    (snapshot.sectionHeaders.brand.isVisible && snapshot.brandSpotlights.length > 0) ||
    (snapshot.sectionHeaders.campaign.isVisible && snapshot.campaignSpotlights.length > 0);

  if (!hasConversionSection) {
    throw badRequestError("Homepage cannot be published without at least one real shoppable section.");
  }
};

const buildPublicHomepageProductCard = (
  product: Awaited<ReturnType<typeof listPublicProductCardsByIds>>[number]
) => {
  const amountCents =
    product.pricing?.amountCents != null
      ? product.pricing.amountCents
      : product.pricing?.minAmountCents != null
        ? product.pricing.minAmountCents
        : null;

  if (
    amountCents == null ||
    !product.primaryMedia?.url ||
    !product.defaultVariantId ||
    product.availability?.inStock !== true
  ) {
    return null;
  }

  return {
    id: product.id,
    slug: product.slug,
    name: product.title,
    category: product.categories[0]?.name ?? "Catalog",
    price: amountCents / 100,
    originalPrice:
      product.pricing?.compareAtAmountCents != null &&
      product.pricing.compareAtAmountCents > amountCents
        ? product.pricing.compareAtAmountCents / 100
        : undefined,
    imageUrl: product.primaryMedia.url,
    rating:
      product.reviewSummary?.averageRating != null && product.reviewSummary.totalReviews > 0
        ? product.reviewSummary.averageRating
        : undefined,
    reviewCount:
      product.reviewSummary?.totalReviews != null && product.reviewSummary.totalReviews > 0
        ? product.reviewSummary.totalReviews
        : undefined,
    description: product.description ?? undefined,
    brand: product.brand?.name ?? undefined,
    defaultVariantId: product.defaultVariantId
  };
};

type ResolvedHomepageProductCard = NonNullable<ReturnType<typeof buildPublicHomepageProductCard>>;

const buildPublicHomepagePayloadFromSnapshot = async (snapshot: PublishedHomepageSnapshot) => {
  const categories = await listCatalogCategories();
  const categoryCountById = new Map(categories.map((category) => [category.id, category.productCount]));
  const categoryCountBySlug = new Map(categories.map((category) => [category.slug, category.productCount]));

  const featuredIds = snapshot.featuredProducts.map((item) => item.productId);
  const brandProductIds = snapshot.brandSpotlights.flatMap((item) => item.productIds);
  const campaignProductIds = snapshot.campaignSpotlights.flatMap((item) => item.productIds);
  const promoProductIds = snapshot.promoOffers.flatMap((item) => item.productIds);
  const allProductIds = Array.from(new Set([...featuredIds, ...brandProductIds, ...campaignProductIds, ...promoProductIds]));

  const productCards = await listPublicProductCardsByIds(allProductIds);
  const productCardMap = new Map(
    productCards
      .map((product) => {
        const mapped = buildPublicHomepageProductCard(product);
        return mapped ? [mapped.id, mapped] : null;
      })
      .filter((entry): entry is [string, ResolvedHomepageProductCard] => Boolean(entry))
  );

  const featuredItems = featuredIds
    .map((productId) => productCardMap.get(productId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const brandItems = snapshot.brandSpotlights.map((item) => ({
    slug: item.slug,
    title: item.title,
    tagline: item.tagline,
    heroImageUrl: item.heroImageUrl,
    ctaLabel: item.ctaLabel,
    href: `/brands/${item.slug}`,
    products: item.productIds
      .map((productId) => productCardMap.get(productId))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  }));
  const campaignItems = snapshot.campaignSpotlights.map((item) => ({
    slug: item.slug,
    title: item.title,
    subtitle: item.subtitle,
    heroImageUrl: item.heroImageUrl,
    label: item.label,
    ctaLabel: item.ctaLabel,
    href: `/campaigns/${item.slug}`,
    layout: item.layout,
    products: item.productIds
      .map((productId) => productCardMap.get(productId))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  }));
  const promoItems = snapshot.promoOffers.map((item) => ({
    badge: item.badge,
    code: item.code,
    headline: item.headline,
    body: item.body,
    terms: item.terms,
    bannerImageUrl: item.bannerImageUrl,
    ctaLabel: item.ctaLabel,
    ctaHref: item.ctaHref,
    products: item.productIds
      .map((productId) => productCardMap.get(productId))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  }));

  return {
    hero: {
      eyebrow: snapshot.hero.eyebrow,
      titlePrefix: snapshot.hero.titlePrefix,
      titleAccent: snapshot.hero.titleAccent ?? null,
      titleSuffix: snapshot.hero.titleSuffix ?? null,
      body: snapshot.hero.body,
      primaryCtaLabel: snapshot.hero.primaryCtaLabel,
      primaryCtaHref: snapshot.hero.primaryCtaHref,
      backgroundImageUrl: snapshot.hero.backgroundImageUrl,
      backgroundImageAlt: snapshot.hero.backgroundImageAlt ?? ""
    },
    trustBadges: snapshot.trustBadges.map((item) => ({
      iconName: item.iconName,
      title: item.title,
      subtitle: item.subtitle,
      href: item.href ?? null,
      ariaLabel: item.ariaLabel ?? null
    })),
    featuredSection: {
      eyebrow: snapshot.sectionHeaders.featured.eyebrow,
      title: snapshot.sectionHeaders.featured.title,
      description: snapshot.sectionHeaders.featured.description,
      ctaLabel: snapshot.sectionHeaders.featured.ctaLabel ?? null,
      ctaHref: snapshot.sectionHeaders.featured.ctaHref ?? null,
      isVisible: snapshot.sectionHeaders.featured.isVisible && featuredItems.length > 0,
      items: featuredItems
    },
    promoSection: {
      eyebrow: snapshot.sectionHeaders.promo.eyebrow,
      title: snapshot.sectionHeaders.promo.title,
      description: snapshot.sectionHeaders.promo.description,
      isVisible: snapshot.sectionHeaders.promo.isVisible && promoItems.length > 0,
      items: promoItems
    },
    categorySection: {
      eyebrow: snapshot.sectionHeaders.category.eyebrow,
      title: snapshot.sectionHeaders.category.title,
      description: snapshot.sectionHeaders.category.description,
      ctaLabel: snapshot.sectionHeaders.category.ctaLabel ?? null,
      ctaHref: snapshot.sectionHeaders.category.ctaHref ?? null,
      isVisible: snapshot.sectionHeaders.category.isVisible && snapshot.categoryTiles.length > 0,
      items: snapshot.categoryTiles.map((item) => ({
        slug: item.slug,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        productCount:
          item.categoryId != null
            ? categoryCountById.get(item.categoryId) ?? 0
            : categoryCountBySlug.get(item.slug) ?? 0,
        href: `/categories/${item.slug}`
      }))
    },
    brandSection: {
      eyebrow: snapshot.sectionHeaders.brand.eyebrow,
      title: snapshot.sectionHeaders.brand.title,
      description: snapshot.sectionHeaders.brand.description,
      ctaLabel: snapshot.sectionHeaders.brand.ctaLabel ?? null,
      ctaHref: snapshot.sectionHeaders.brand.ctaHref ?? null,
      isVisible: snapshot.sectionHeaders.brand.isVisible && brandItems.length > 0,
      items: brandItems
    },
    campaignSection: {
      eyebrow: snapshot.sectionHeaders.campaign.eyebrow,
      title: snapshot.sectionHeaders.campaign.title,
      description: snapshot.sectionHeaders.campaign.description,
      ctaLabel: snapshot.sectionHeaders.campaign.ctaLabel ?? null,
      ctaHref: snapshot.sectionHeaders.campaign.ctaHref ?? null,
      isVisible: snapshot.sectionHeaders.campaign.isVisible && campaignItems.length > 0,
      items: campaignItems
    },
    testimonialSection: {
      eyebrow: snapshot.sectionHeaders.testimonial.eyebrow,
      title: snapshot.sectionHeaders.testimonial.title,
      description: snapshot.sectionHeaders.testimonial.description,
      isVisible: snapshot.sectionHeaders.testimonial.isVisible && snapshot.testimonials.length > 0,
      items: snapshot.testimonials.map((item) => ({
        quote: item.quote,
        customerName: item.customerName,
        imageUrl: item.imageUrl,
        statusLabel: item.statusLabel ?? "Verified purchase"
      }))
    }
  };
};

const maybeNormalizeHomepageVersion = async (
  transaction: Prisma.TransactionClient,
  record: HomePageVersionRecord
) => {
  const banner = await findPrimaryHomepageBanner(transaction);
  const current = normalizeDraftInput(extractDraftInput(record));
  let next = {
    ...current,
    sectionHeaders: cloneSectionHeaders(current.sectionHeaders)
  };
  let changed = false;

  const normalizedHeaders = normalizeSectionHeaders(current.sectionHeaders);
  if (JSON.stringify(normalizedHeaders) !== JSON.stringify(current.sectionHeaders)) {
    next = {
      ...next,
      sectionHeaders: normalizedHeaders
    };
    changed = true;
  }

  if ((isMockHero(next.hero) || !next.hero.backgroundImageUrl.trim()) && banner?.mediaUrl) {
    next = {
      ...next,
      hero: buildBannerFallbackHero(banner)
    };
    changed = true;
  }

  if (hasMockPromoOffers(next.promoOffers)) {
    next = {
      ...next,
      promoOffers: [],
      sectionHeaders: {
        ...next.sectionHeaders,
        promo: {
          ...next.sectionHeaders.promo,
          isVisible: false,
          contentMode: "MANUAL"
        }
      }
    };
    changed = true;
  }

  if (hasMockTestimonials(next.testimonials)) {
    next = {
      ...next,
      testimonials: [],
      sectionHeaders: {
        ...next.sectionHeaders,
        testimonial: {
          ...next.sectionHeaders.testimonial,
          isVisible: false,
          contentMode: "MANUAL"
        }
      }
    };
    changed = true;
  }

  if (record.state === HomePageVersionState.PUBLISHED) {
    const hasAutoContent = (Object.keys(next.sectionHeaders) as SectionHeaderKey[]).some(
      (key) => next.sectionHeaders[key].contentMode === "AUTO"
    );

    if (hasAutoContent) {
      const resolved = await resolveHomepageSnapshot(transaction, next);
      next = resolved.snapshot;
      changed = true;
    }
  }

  if (changed) {
    await writeVersionContent(transaction, record.id, next);
  }
};

const ensureHomepageWorkspace = async () => {
  let draft = await getVersion(prisma, HomePageVersionState.DRAFT);
  if (!draft) {
    const banner = await findPrimaryHomepageBanner(prisma);
    await prisma.$transaction(async (transaction) => {
      const created = await transaction.homePageVersion.create({
        data: {
          state: HomePageVersionState.DRAFT
        }
      });
      await writeVersionContent(transaction, created.id, buildInitialHomepageDraft(banner));
    }, HOMEPAGE_TRANSACTION_OPTIONS);

    draft = await getVersion(prisma, HomePageVersionState.DRAFT);
  }

  if (!draft) {
    throw notFoundError("The homepage workspace could not be initialized.");
  }

  await prisma.$transaction(async (transaction) => {
    const draftVersion = await getVersion(transaction, HomePageVersionState.DRAFT);
    if (draftVersion) {
      await maybeNormalizeHomepageVersion(transaction, draftVersion);
    }

    const publishedVersion = await getVersion(transaction, HomePageVersionState.PUBLISHED);
    if (publishedVersion) {
      await maybeNormalizeHomepageVersion(transaction, publishedVersion);
    }
  }, HOMEPAGE_TRANSACTION_OPTIONS);

  const normalizedDraft = await getVersion(prisma, HomePageVersionState.DRAFT);
  if (!normalizedDraft) {
    throw notFoundError("The homepage workspace could not be initialized.");
  }

  return normalizedDraft;
};

const listHomepageEditorOptions = async () => {
  const [categories, products, brands, campaigns] = await Promise.all([
    prisma.category.findMany({
      where: {
        status: "ACTIVE"
      },
      orderBy: {
        name: "asc"
      },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    }),
    prisma.product.findMany({
      where: {
        status: ProductStatus.PUBLISHED
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 120,
      select: {
        id: true,
        slug: true,
        title: true,
        brand: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.brand.findMany({
      where: {
        status: "ACTIVE"
      },
      orderBy: {
        name: "asc"
      },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true
      }
    }),
    prisma.campaign.findMany({
      where: {
        status: PromotionStatus.ACTIVE
      },
      orderBy: {
        updatedAt: "desc"
      },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true
      }
    })
  ]);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      productCount: category._count.products
    })),
    products: products.map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.title,
      brandName: product.brand?.name ?? null
    })),
    brands,
    campaigns
  };
};

const buildAdminHomepageWorkspace = async () => {
  const draft = await ensureHomepageWorkspace();
  const published = await getVersion(prisma, HomePageVersionState.PUBLISHED);
  const resolved = await resolveHomepageSnapshot(prisma, extractDraftInput(draft));
  const resolvedPreview = await buildPublicHomepagePayloadFromSnapshot(resolved.snapshot);

  return {
    entity: serializeDraftEntity(draft, published?.publishedAt?.toISOString() ?? null),
    resolvedPreview,
    warnings: resolved.warnings,
    options: await listHomepageEditorOptions()
  };
};

export const getAdminHomepageDraft = async () => buildAdminHomepageWorkspace();

export const saveAdminHomepageDraft = async (input: {
  actorAdminUserId: string;
  expectedDraftUpdatedAt: string;
  draft: HomepageDraftInput;
}) => {
  const normalizedDraft = normalizeDraftInput(input.draft);
  const beforeDraft = await ensureHomepageWorkspace();
  const beforePublished = await getVersion(prisma, HomePageVersionState.PUBLISHED);

  await prisma.$transaction(async (transaction) => {
    const currentDraft = await getVersion(transaction, HomePageVersionState.DRAFT);
    if (!currentDraft) {
      throw notFoundError("The homepage workspace could not be initialized.");
    }

    if (currentDraft.updatedAt.toISOString() !== input.expectedDraftUpdatedAt) {
      throw conflictError("The homepage draft changed before this save completed.", {
        currentDraftUpdatedAt: currentDraft.updatedAt.toISOString()
      });
    }

    await writeVersionContent(transaction, currentDraft.id, normalizedDraft);
    const updatedDraft = await getVersion(transaction, HomePageVersionState.DRAFT);
    await recordHomepageMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.homepage.update",
      before: serializeDraftEntity(beforeDraft, beforePublished?.publishedAt?.toISOString() ?? null),
      after: updatedDraft
        ? serializeDraftEntity(updatedDraft, beforePublished?.publishedAt?.toISOString() ?? null)
        : null
    });
  }, HOMEPAGE_TRANSACTION_OPTIONS);

  return buildAdminHomepageWorkspace();
};

export const publishAdminHomepageDraft = async (input: {
  actorAdminUserId: string;
  expectedDraftUpdatedAt: string;
  draft: HomepageDraftInput;
}) => {
  const normalizedDraft = normalizeDraftInput(input.draft);
  const beforeDraft = await ensureHomepageWorkspace();
  const beforePublished = await getVersion(prisma, HomePageVersionState.PUBLISHED);

  await prisma.$transaction(async (transaction) => {
    const currentDraft = await getVersion(transaction, HomePageVersionState.DRAFT);
    if (!currentDraft) {
      throw notFoundError("The homepage workspace could not be initialized.");
    }

    if (currentDraft.updatedAt.toISOString() !== input.expectedDraftUpdatedAt) {
      throw conflictError("The homepage draft changed before this publish completed.", {
        currentDraftUpdatedAt: currentDraft.updatedAt.toISOString()
      });
    }

    await writeVersionContent(transaction, currentDraft.id, normalizedDraft);
    const updatedDraft = await getVersion(transaction, HomePageVersionState.DRAFT);

    const resolved = await resolveHomepageSnapshot(transaction, normalizedDraft);
    assertPublishableHomepageSnapshot(resolved.snapshot);

    const existingPublished = await transaction.homePageVersion.findUnique({
      where: {
        state: HomePageVersionState.PUBLISHED
      }
    });

    if (existingPublished) {
      await transaction.homePageVersion.delete({
        where: {
          id: existingPublished.id
        }
      });
    }

    const publishedVersion = await transaction.homePageVersion.create({
      data: {
        state: HomePageVersionState.PUBLISHED,
        publishedAt: new Date()
      }
    });

    await writeVersionContent(transaction, publishedVersion.id, resolved.snapshot);

    await recordHomepageMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.homepage.update",
      before: serializeDraftEntity(beforeDraft, beforePublished?.publishedAt?.toISOString() ?? null),
      after: updatedDraft
        ? serializeDraftEntity(updatedDraft, beforePublished?.publishedAt?.toISOString() ?? null)
        : null
    });

    await recordHomepageMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.homepage.publish",
      before: beforePublished ? extractDraftInput(beforePublished) : null,
      after: resolved.snapshot
    });
  }, HOMEPAGE_TRANSACTION_OPTIONS);

  return buildAdminHomepageWorkspace();
};

export const unpublishAdminHomepage = async (input: {
  actorAdminUserId: string;
}) => {
  const published = await getVersion(prisma, HomePageVersionState.PUBLISHED);
  if (!published) {
    return buildAdminHomepageWorkspace();
  }

  const draft = await ensureHomepageWorkspace();

  await prisma.$transaction(async (transaction) => {
    await transaction.homePageVersion.delete({
      where: {
        id: published.id
      }
    });

    await recordHomepageMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.homepage.unpublish",
      before: extractDraftInput(published),
      after: serializeDraftEntity(draft, null)
    });
  }, HOMEPAGE_TRANSACTION_OPTIONS);

  return buildAdminHomepageWorkspace();
};

export const getPublicHomepage = async () => {
  await ensureHomepageWorkspace();

  const published = await getVersion(prisma, HomePageVersionState.PUBLISHED);
  if (!published) {
    throw notFoundError("The homepage is not currently published.");
  }

  const snapshot = normalizeDraftInput(extractDraftInput(published));
  const entity = await buildPublicHomepagePayloadFromSnapshot(snapshot);

  return {
    entity,
    meta: {
      publishedAt: published.publishedAt?.toISOString() ?? published.updatedAt.toISOString(),
      updatedAt: published.updatedAt.toISOString()
    }
  };
};
