import {
  HomePageCampaignLayout,
  HomePageSectionHeaderKind,
  HomePageVersionState,
  Prisma,
  ProductStatus,
  PromotionStatus
} from "@prisma/client";

import { notFoundError } from "../../common/errors/app-error";
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

type SectionHeaderInput = {
  isVisible: boolean;
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
    primaryCtaHref: string;
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
    ctaHref: string;
    productIds: string[];
  }>;
  testimonials: Array<{
    quote: string;
    customerName: string;
    imageUrl: string;
    statusLabel?: string | null;
  }>;
};

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
  sectionHeaders: true,
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

const homepageImage = (id: string, width: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=85&w=${width}`;

const defaultImages = {
  heroHome: homepageImage("1596462502278-27bfdc403348", 2400),
  campaignPrimary: homepageImage("1608231387042-66d1773070a5", 2000),
  campaignSecondary: homepageImage("1571781926291-c477ebfd024b", 2000),
  campaignLink: homepageImage("1556228720-195a672e8a03", 2000),
  promoFirst: homepageImage("1620916566398-39f1143ab7be", 2000),
  promoPair: homepageImage("1483985988355-763728e1935b", 2000),
  categoryOuterwear: homepageImage("1515886657613-9f3515b0c78f", 1200),
  categoryFootwear: homepageImage("1542291026-7eec264c27ff", 1200),
  categoryBasics: homepageImage("1521572163474-6864f9cf17ab", 1200),
  categoryKnitwear: homepageImage("1441986300917-64674bd600d8", 1200),
  categoryEyewear: homepageImage("1572635196237-14b3f281503f", 1200),
  brandFirst: homepageImage("1483985988355-763728e1935b", 1200),
  brandSecond: homepageImage("1521572163474-6864f9cf17ab", 1200),
  brandThird: homepageImage("1542291026-7eec264c27ff", 1200),
  testimonial1: homepageImage("1494790108377-be9c29b29330", 256),
  testimonial2: homepageImage("1507003211169-0a1dd7228f2d", 256),
  testimonial3: homepageImage("1438761681033-6461ffad8d80", 256)
} as const;

const readSectionHeaders = (record: HomePageVersionRecord["sectionHeaders"]) => {
  const entries = Object.fromEntries(
    record.map((header) => [
      headerKeyByKind[header.kind],
      {
        isVisible: header.isVisible,
        eyebrow: header.eyebrow,
        title: header.title,
        description: header.description,
        ctaLabel: header.ctaLabel,
        ctaHref: header.ctaHref
      }
    ])
  ) as Partial<Record<SectionHeaderKey, SectionHeaderInput>>;

  const fallback = (): SectionHeaderInput => ({
    isVisible: true,
    eyebrow: "",
    title: "",
    description: "",
    ctaLabel: null,
    ctaHref: null
  });

  return {
    category: entries.category ?? fallback(),
    featured: entries.featured ?? fallback(),
    brand: entries.brand ?? fallback(),
    campaign: entries.campaign ?? fallback(),
    promo: entries.promo ?? fallback(),
    testimonial: entries.testimonial ?? fallback()
  } satisfies Record<SectionHeaderKey, SectionHeaderInput>;
};

const serializeDraftEntity = (record: HomePageVersionRecord, publishedAt: string | null) => ({
  status: {
    hasPublishedVersion: Boolean(publishedAt),
    draftUpdatedAt: record.updatedAt.toISOString(),
    publishedAt
  },
  hero: {
    eyebrow: record.hero?.eyebrow ?? "",
    titlePrefix: record.hero?.titlePrefix ?? "",
    titleAccent: record.hero?.titleAccent ?? null,
    titleSuffix: record.hero?.titleSuffix ?? null,
    body: record.hero?.body ?? "",
    primaryCtaLabel: record.hero?.primaryCtaLabel ?? "",
    primaryCtaHref: record.hero?.primaryCtaHref ?? "/shop",
    backgroundImageUrl: record.hero?.backgroundImageUrl ?? defaultImages.heroHome,
    backgroundImageAlt: record.hero?.backgroundImageAlt ?? null
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
    layout: item.layout,
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

const extractDraftInput = (record: HomePageVersionRecord): HomepageDraftInput => ({
  hero: {
    eyebrow: record.hero?.eyebrow ?? "",
    titlePrefix: record.hero?.titlePrefix ?? "",
    titleAccent: record.hero?.titleAccent ?? null,
    titleSuffix: record.hero?.titleSuffix ?? null,
    body: record.hero?.body ?? "",
    primaryCtaLabel: record.hero?.primaryCtaLabel ?? "",
    primaryCtaHref: record.hero?.primaryCtaHref ?? "/shop",
    backgroundImageUrl: record.hero?.backgroundImageUrl ?? defaultImages.heroHome,
    backgroundImageAlt: record.hero?.backgroundImageAlt ?? null
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
    layout: item.layout,
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

const buildDefaultHomepageDraft = async (db: DatabaseClient): Promise<HomepageDraftInput> => {
  const [categories, products, brands, campaigns] = await Promise.all([
    db.category.findMany({
      where: {
        status: "ACTIVE"
      },
      orderBy: {
        name: "asc"
      },
      take: 5,
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    }),
    db.product.findMany({
      where: {
        status: ProductStatus.PUBLISHED
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 16,
      select: {
        id: true,
        slug: true,
        title: true,
        brandId: true
      }
    }),
    db.brand.findMany({
      where: {
        status: "ACTIVE"
      },
      orderBy: {
        name: "asc"
      },
      take: 3,
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true
      }
    }),
    db.campaign.findMany({
      where: {
        status: PromotionStatus.ACTIVE
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 3,
      include: {
        banners: {
          where: {
            status: "PUBLISHED"
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          take: 1
        }
      }
    })
  ]);

  const brandProductsByBrandId = new Map<string, string[]>();

  await Promise.all(
    brands.map(async (brand) => {
      const brandProducts = await db.product.findMany({
        where: {
          status: ProductStatus.PUBLISHED,
          brandId: brand.id
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 3,
        select: {
          id: true
        }
      });
      brandProductsByBrandId.set(
        brand.id,
        brandProducts.map((product) => product.id)
      );
    })
  );

  const categoryImages = [
    defaultImages.categoryOuterwear,
    defaultImages.categoryFootwear,
    defaultImages.categoryBasics,
    defaultImages.categoryKnitwear,
    defaultImages.categoryEyewear
  ];
  const brandImages = [defaultImages.brandFirst, defaultImages.brandSecond, defaultImages.brandThird];
  const featuredProductIds = products.slice(0, 4).map((product) => product.id);
  const campaignLink = campaigns[2];
  const campaignPrimaryProducts = products.slice(0, 4).map((product) => product.id);
  const campaignSecondaryProducts = products.slice(4, 8).map((product) => product.id);

  return {
    hero: {
      eyebrow: "Storefront homepage",
      titlePrefix: "Color that",
      titleAccent: "performs",
      titleSuffix: ".",
      body:
        "Pigment-rich makeup, skin-first essentials, and fast-moving edits managed from the admin workspace.",
      primaryCtaLabel: "Shop the edit",
      primaryCtaHref: "/shop",
      backgroundImageUrl: defaultImages.heroHome,
      backgroundImageAlt: "Curated beauty products arranged as the homepage hero."
    },
    sectionHeaders: {
      category: {
        isVisible: true,
        eyebrow: "Shop by category",
        title: "Find your lane — every link opens the full aisle",
        description: "Jump into the core storefront categories and route customers straight into the right aisle.",
        ctaLabel: "Full catalogue",
        ctaHref: "/shop"
      },
      featured: {
        isVisible: true,
        eyebrow: "Featured now",
        title: "Editor's selection",
        description: "New arrivals, proven sellers, and products worth highlighting right now.",
        ctaLabel: "View all",
        ctaHref: "/shop"
      },
      brand: {
        isVisible: true,
        eyebrow: "The houses",
        title: "Brands with a point of view",
        description: "Spotlight partner brands and route customers into the full collection or straight to a product.",
        ctaLabel: "All brands",
        ctaHref: "/brands"
      },
      campaign: {
        isVisible: true,
        eyebrow: "Campaigns",
        title: "Seasonal edits & limited runs",
        description: "Highlight campaign-led merchandising blocks with dedicated CTA routing.",
        ctaLabel: campaignLink ? campaignLink.name : "Shop campaigns",
        ctaHref: campaignLink ? `/campaigns/${campaignLink.slug}` : "/shop"
      },
      promo: {
        isVisible: true,
        eyebrow: "Member offers",
        title: "Codes & curated picks",
        description: "Transparent terms and a curated product group for each offer."
      },
      testimonial: {
        isVisible: true,
        eyebrow: "Trust",
        title: "Loved by the community",
        description: "Verified customer quotes that reinforce packaging, quality, and support."
      }
    },
    trustBadges: [
      {
        iconName: "verified_user",
        title: "Authenticated edit",
        subtitle: "Vetted partners & materials",
        href: "/about"
      },
      {
        iconName: "local_shipping",
        title: "Insured delivery",
        subtitle: "Complimentary over qualifying totals",
        href: "/pages/shipping-policy"
      },
      {
        iconName: "assignment_return",
        title: "30-day returns",
        subtitle: "Prepaid labels · no hassle",
        href: "/pages/returns-policy"
      },
      {
        iconName: "support_agent",
        title: "Concierge care",
        subtitle: "Styling & order help",
        href: "/support"
      }
    ],
    categoryTiles: categories.map((category, index) => ({
      categoryId: category.id,
      slug: category.slug,
      title: category.name,
      description:
        category._count.products > 0
          ? `${category._count.products} product${category._count.products === 1 ? "" : "s"} currently published`
          : "Merchandising-ready category slot",
      imageUrl: categoryImages[index] ?? categoryImages[categoryImages.length - 1]!
    })),
    featuredProducts: featuredProductIds.map((productId) => ({
      productId
    })),
    brandSpotlights: brands.map((brand, index) => ({
      brandId: brand.id,
      slug: brand.slug,
      title: brand.name,
      tagline: `Featured brand spotlight for ${brand.name}.`,
      heroImageUrl: brand.logoUrl || brandImages[index] || brandImages[brandImages.length - 1]!,
      ctaLabel: `Full ${brand.name} collection`,
      productIds: brandProductsByBrandId.get(brand.id) ?? []
    })),
    campaignSpotlights: campaigns.slice(0, 2).map((campaign, index) => ({
      campaignId: campaign.id,
      slug: campaign.slug,
      title: campaign.name,
      subtitle:
        index === 0
          ? "Primary campaign block with a large visual and curated picks."
          : "Secondary campaign block with a shorter supporting story.",
      heroImageUrl:
        campaign.banners[0]?.mediaUrl ||
        (index === 0 ? defaultImages.campaignPrimary : defaultImages.campaignSecondary),
      label: index === 0 ? "Featured campaign" : "Second story",
      ctaLabel: index === 0 ? "Open edit" : "View campaign",
      layout: index === 0 ? "FEATURE" : "SPLIT",
      productIds: index === 0 ? campaignPrimaryProducts : campaignSecondaryProducts
    })),
    promoOffers: [
      {
        badge: "First purchase",
        code: "EDIT15",
        headline: "15% off your first full-price order",
        body:
          "Use the homepage to spotlight launch offers, seasonal pricing, or onboarding incentives with curated products.",
        terms: "Configure offer eligibility and checkout logic separately; this homepage slot is presentation-first.",
        bannerImageUrl: defaultImages.promoFirst,
        ctaLabel: "Browse eligible edit",
        ctaHref: "/shop",
        productIds: products.slice(0, 3).map((product) => product.id)
      },
      {
        badge: "Pair & save",
        code: "LAYER20",
        headline: "Promote bundle-style pairings",
        body:
          "Use this slot for cart incentives, layered merchandising stories, or pair-and-save style promotions.",
        terms: "The homepage offer content is managed here; enforcement still belongs in pricing, coupon, or promotion logic.",
        bannerImageUrl: defaultImages.promoPair,
        ctaLabel: "Shop the pairing",
        ctaHref: "/shop",
        productIds: products.slice(3, 6).map((product) => product.id)
      }
    ],
    testimonials: [
      {
        quote:
          "\"The homepage now feels intentional. Promotions, products, and campaigns finally line up with what the team is actually selling this week.\"",
        customerName: "Eleanor Vance",
        imageUrl: defaultImages.testimonial1,
        statusLabel: "Verified purchase"
      },
      {
        quote:
          "\"Support helped me pick the right bundle and the homepage offer matched exactly what I saw in checkout. That consistency matters.\"",
        customerName: "Julian Archer",
        imageUrl: defaultImages.testimonial2,
        statusLabel: "Verified purchase"
      },
      {
        quote:
          "\"The curated campaign block pulled me straight into the launch. It felt edited, not random.\"",
        customerName: "Sasha Grey",
        imageUrl: defaultImages.testimonial3,
        statusLabel: "Verified purchase"
      }
    ]
  };
};

const getVersion = async (db: DatabaseClient, state: HomePageVersionState) =>
  db.homePageVersion.findUnique({
    where: {
      state
    },
    include: homepageVersionInclude
  });

const ensureHomepageSeeded = async () => {
  const existingDraft = await getVersion(prisma, HomePageVersionState.DRAFT);
  if (existingDraft) {
    return existingDraft;
  }

  const draftInput = await buildDefaultHomepageDraft(prisma);

  await prisma.$transaction(async (transaction) => {
    const draft = await transaction.homePageVersion.create({
      data: {
        state: HomePageVersionState.DRAFT
      }
    });

    await writeVersionContent(transaction, draft.id, draftInput);

    const published = await transaction.homePageVersion.create({
      data: {
        state: HomePageVersionState.PUBLISHED,
        publishedAt: new Date()
      }
    });

    await writeVersionContent(transaction, published.id, draftInput);
  });

  const seededDraft = await getVersion(prisma, HomePageVersionState.DRAFT);
  if (!seededDraft) {
    throw notFoundError("The homepage workspace could not be initialized.");
  }

  return seededDraft;
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
      ...input.hero
    },
    update: {
      ...input.hero
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
        ctaHref: promo.ctaHref
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
}

const mapPublicProductCard = (
  product: Awaited<ReturnType<typeof listPublicProductCardsByIds>>[number]
) => ({
  id: product.id,
  slug: product.slug,
  name: product.title,
  category: product.categories[0]?.name ?? "Product",
  price:
    product.pricing?.amountCents != null
      ? product.pricing.amountCents / 100
      : product.pricing?.minAmountCents != null
        ? product.pricing.minAmountCents / 100
        : 0,
  originalPrice:
    product.pricing?.compareAtAmountCents != null
      ? product.pricing.compareAtAmountCents / 100
      : undefined,
  imageUrl: product.primaryMedia?.url ?? defaultImages.brandFirst,
  rating: product.reviewSummary.averageRating ?? 4,
  reviewCount: product.reviewSummary.totalReviews ?? 0,
  description: product.description ?? undefined,
  brand: product.brand?.name ?? undefined
});

const buildPublicHomepagePayload = async (record: HomePageVersionRecord) => {
  const categories = await listCatalogCategories();
  const categoryCountById = new Map(categories.map((category) => [category.id, category.productCount]));
  const categoryCountBySlug = new Map(categories.map((category) => [category.slug, category.productCount]));

  const featuredProductIds = record.featuredProducts.map((item) => item.productId);
  const brandProductIds = record.brandSpotlights.flatMap((item) =>
    item.products.map((product) => product.productId)
  );
  const campaignProductIds = record.campaignSpotlights.flatMap((item) =>
    item.products.map((product) => product.productId)
  );
  const promoProductIds = record.promoOffers.flatMap((item) =>
    item.products.map((product) => product.productId)
  );

  const uniqueProductIds = Array.from(
    new Set([...featuredProductIds, ...brandProductIds, ...campaignProductIds, ...promoProductIds])
  );
  const productCards = await listPublicProductCardsByIds(uniqueProductIds);
  const productCardMap = new Map(
    productCards.map((product) => [product.id, mapPublicProductCard(product)])
  );

  const sectionHeaders = readSectionHeaders(record.sectionHeaders);

  return {
    hero: {
      eyebrow: record.hero?.eyebrow ?? "",
      titlePrefix: record.hero?.titlePrefix ?? "",
      titleAccent: record.hero?.titleAccent ?? null,
      titleSuffix: record.hero?.titleSuffix ?? null,
      body: record.hero?.body ?? "",
      primaryCtaLabel: record.hero?.primaryCtaLabel ?? "",
      primaryCtaHref: record.hero?.primaryCtaHref ?? "/shop",
      backgroundImageUrl: record.hero?.backgroundImageUrl ?? defaultImages.heroHome,
      backgroundImageAlt: record.hero?.backgroundImageAlt ?? ""
    },
    trustBadges: record.trustBadges.map((item) => ({
      iconName: item.iconName,
      title: item.title,
      subtitle: item.subtitle,
      href: item.href,
      ariaLabel: item.ariaLabel
    })),
    categorySection: {
      ...sectionHeaders.category,
      items: record.categoryTiles.map((item) => ({
        slug: item.slug,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        productCount:
          item.categoryId != null
            ? (categoryCountById.get(item.categoryId) ?? 0)
            : (categoryCountBySlug.get(item.slug) ?? 0),
        href: `/categories/${item.slug}`
      }))
    },
    featuredSection: {
      ...sectionHeaders.featured,
      items: featuredProductIds
        .map((productId) => productCardMap.get(productId))
        .filter((product): product is NonNullable<typeof product> => Boolean(product))
    },
    brandSection: {
      ...sectionHeaders.brand,
      items: record.brandSpotlights.map((item) => ({
        slug: item.slug,
        title: item.title,
        tagline: item.tagline,
        heroImageUrl: item.heroImageUrl,
        ctaLabel: item.ctaLabel,
        href: `/brands/${item.slug}`,
        products: item.products
          .map((product) => productCardMap.get(product.productId))
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      }))
    },
    campaignSection: {
      ...sectionHeaders.campaign,
      items: record.campaignSpotlights.map((item) => ({
        slug: item.slug,
        title: item.title,
        subtitle: item.subtitle,
        heroImageUrl: item.heroImageUrl,
        label: item.label,
        ctaLabel: item.ctaLabel,
        href: `/campaigns/${item.slug}`,
        layout: item.layout,
        products: item.products
          .map((product) => productCardMap.get(product.productId))
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      }))
    },
    promoSection: {
      ...sectionHeaders.promo,
      items: record.promoOffers.map((item) => ({
        badge: item.badge,
        code: item.code,
        headline: item.headline,
        body: item.body,
        terms: item.terms,
        bannerImageUrl: item.bannerImageUrl,
        ctaLabel: item.ctaLabel,
        ctaHref: item.ctaHref,
        products: item.products
          .map((product) => productCardMap.get(product.productId))
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      }))
    },
    testimonialSection: {
      ...sectionHeaders.testimonial,
      items: record.testimonials.map((item) => ({
        quote: item.quote,
        customerName: item.customerName,
        imageUrl: item.imageUrl,
        statusLabel: item.statusLabel
      }))
    }
  };
};

export const getAdminHomepageDraft = async () => {
  const draft = await ensureHomepageSeeded();
  const published = await getVersion(prisma, HomePageVersionState.PUBLISHED);

  return {
    entity: serializeDraftEntity(draft, published?.publishedAt?.toISOString() ?? null),
    options: await listHomepageEditorOptions()
  };
};

export const saveAdminHomepageDraft = async (input: {
  actorAdminUserId: string;
  draft: HomepageDraftInput;
}) => {
  const beforeDraft = await ensureHomepageSeeded();
  const beforePublished = await getVersion(prisma, HomePageVersionState.PUBLISHED);

  await prisma.$transaction(async (transaction) => {
    const draftVersion = await transaction.homePageVersion.upsert({
      where: {
        state: HomePageVersionState.DRAFT
      },
      update: {},
      create: {
        state: HomePageVersionState.DRAFT
      }
    });

    await writeVersionContent(transaction, draftVersion.id, input.draft);

    const updatedDraft = await getVersion(transaction, HomePageVersionState.DRAFT);
    await recordHomepageMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.homepage.update",
      before: serializeDraftEntity(beforeDraft, beforePublished?.publishedAt?.toISOString() ?? null),
      after: updatedDraft
        ? serializeDraftEntity(updatedDraft, beforePublished?.publishedAt?.toISOString() ?? null)
        : null
    });
  });

  return getAdminHomepageDraft();
};

export const publishAdminHomepageDraft = async (input: {
  actorAdminUserId: string;
}) => {
  const draft = await ensureHomepageSeeded();
  const beforePublished = await getVersion(prisma, HomePageVersionState.PUBLISHED);
  const snapshot = extractDraftInput(draft);

  await prisma.$transaction(async (transaction) => {
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

    await writeVersionContent(transaction, publishedVersion.id, snapshot);

    const updatedPublished = await getVersion(transaction, HomePageVersionState.PUBLISHED);
    await recordHomepageMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.homepage.publish",
      before: beforePublished
        ? serializeDraftEntity(draft, beforePublished.publishedAt?.toISOString() ?? null)
        : null,
      after: updatedPublished
        ? serializeDraftEntity(draft, updatedPublished.publishedAt?.toISOString() ?? null)
        : snapshot
    });
  });

  return getAdminHomepageDraft();
};

export const unpublishAdminHomepage = async (input: {
  actorAdminUserId: string;
}) => {
  const published = await getVersion(prisma, HomePageVersionState.PUBLISHED);
  if (!published) {
    return getAdminHomepageDraft();
  }

  const draft = await ensureHomepageSeeded();

  await prisma.$transaction(async (transaction) => {
    await transaction.homePageVersion.delete({
      where: {
        id: published.id
      }
    });

    await recordHomepageMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.homepage.unpublish",
      before: serializeDraftEntity(draft, published.publishedAt?.toISOString() ?? null),
      after: serializeDraftEntity(draft, null)
    });
  });

  return getAdminHomepageDraft();
};

export const getPublicHomepage = async () => {
  await ensureHomepageSeeded();

  const published = await getVersion(prisma, HomePageVersionState.PUBLISHED);
  if (!published) {
    throw notFoundError("The homepage is not currently published.");
  }

  return {
    entity: await buildPublicHomepagePayload(published),
    meta: {
      publishedAt: published.publishedAt?.toISOString() ?? published.updatedAt.toISOString(),
      updatedAt: published.updatedAt.toISOString()
    }
  };
};
