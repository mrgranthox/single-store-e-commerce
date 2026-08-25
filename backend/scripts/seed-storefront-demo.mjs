import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

const force = process.env.FORCE_STOREFRONT_DEMO === "1";

const media = {
  hero: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1800&q=85",
  dress: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85",
  shirt: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=85",
  sneakers: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85",
  jacket: "https://images.unsplash.com/photo-1506629905607-d405b7a30db9?auto=format&fit=crop&w=1200&q=85",
  campaign: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=85",
  testimonial: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=85"
};

const products = [
  {
    slug: "demo-tailored-midi-dress",
    title: "Tailored Midi Dress",
    description: "Structured occasionwear with a clean waistline and breathable lining.",
    category: { slug: "women", name: "Women", imageUrl: media.dress },
    brand: { slug: "tees-atelier", name: "Tees Atelier" },
    sku: "DEMO-DRESS-001",
    priceAmountCents: 42000,
    compareAtPriceAmountCents: 50000,
    imageUrl: media.dress,
    attributes: { size: "M", color: "Ivory" },
    stock: 24
  },
  {
    slug: "demo-everyday-cotton-shirt",
    title: "Everyday Cotton Shirt",
    description: "Soft cotton shirting designed for workdays, weekends, and layering.",
    category: { slug: "shirts", name: "Shirts", imageUrl: media.shirt },
    brand: { slug: "tees-essentials", name: "Tees Essentials" },
    sku: "DEMO-SHIRT-001",
    priceAmountCents: 18000,
    compareAtPriceAmountCents: 22000,
    imageUrl: media.shirt,
    attributes: { size: "L", color: "Blue" },
    stock: 36
  },
  {
    slug: "demo-city-runner-sneakers",
    title: "City Runner Sneakers",
    description: "Lightweight sneakers with cushioned support for daily movement.",
    category: { slug: "footwear", name: "Footwear", imageUrl: media.sneakers },
    brand: { slug: "urban-step", name: "Urban Step" },
    sku: "DEMO-SNEAKER-001",
    priceAmountCents: 35000,
    compareAtPriceAmountCents: 40000,
    imageUrl: media.sneakers,
    attributes: { size: "42", color: "Red" },
    stock: 18
  },
  {
    slug: "demo-weekend-cropped-jacket",
    title: "Weekend Cropped Jacket",
    description: "A compact outer layer with a clean profile and practical pockets.",
    category: { slug: "outerwear", name: "Outerwear", imageUrl: media.jacket },
    brand: { slug: "tees-atelier", name: "Tees Atelier" },
    sku: "DEMO-JACKET-001",
    priceAmountCents: 56000,
    compareAtPriceAmountCents: 64000,
    imageUrl: media.jacket,
    attributes: { size: "M", color: "Sand" },
    stock: 14
  }
];

const sectionHeaders = {
  category: {
    kind: "CATEGORY",
    isVisible: true,
    contentMode: "MANUAL",
    eyebrow: "Shop by category",
    title: "Find the right edit fast",
    description: "Start with focused collections that make browsing clear.",
    ctaLabel: "Shop all",
    ctaHref: "/shop"
  },
  featured: {
    kind: "FEATURED",
    isVisible: true,
    contentMode: "MANUAL",
    eyebrow: "Featured now",
    title: "Live products ready to buy",
    description: "A small merchandising set for validating catalog, cart, and checkout flows.",
    ctaLabel: "Shop featured",
    ctaHref: "/shop"
  },
  brand: {
    kind: "BRAND",
    isVisible: true,
    contentMode: "MANUAL",
    eyebrow: "Brand spotlight",
    title: "Built around complete outfits",
    description: "Brand blocks prove the homepage can support curated merchandising.",
    ctaLabel: "Browse brands",
    ctaHref: "/brands"
  },
  campaign: {
    kind: "CAMPAIGN",
    isVisible: true,
    contentMode: "MANUAL",
    eyebrow: "Campaign",
    title: "New season launch",
    description: "A campaign surface wired to real products for frontend QA.",
    ctaLabel: "View campaign",
    ctaHref: "/shop"
  },
  promo: {
    kind: "PROMO",
    isVisible: true,
    contentMode: "MANUAL",
    eyebrow: "Offer",
    title: "Test a promotion block",
    description: "Use this block to validate offer rendering and CTA behavior.",
    ctaLabel: null,
    ctaHref: null
  },
  testimonial: {
    kind: "TESTIMONIAL",
    isVisible: true,
    contentMode: "MANUAL",
    eyebrow: "Customer proof",
    title: "What shoppers should see",
    description: "A lightweight proof section for visual regression checks.",
    ctaLabel: null,
    ctaHref: null
  }
};

const writeHomepageContent = async (tx, versionId, seeded) => {
  await tx.homePageBrandSpotlightProduct.deleteMany({ where: { brandSpotlight: { versionId } } });
  await tx.homePageCampaignSpotlightProduct.deleteMany({ where: { campaignSpotlight: { versionId } } });
  await tx.homePagePromoOfferProduct.deleteMany({ where: { promoOffer: { versionId } } });
  await tx.homePageHero.deleteMany({ where: { versionId } });
  await tx.homePageSectionHeader.deleteMany({ where: { versionId } });
  await tx.homePageTrustBadge.deleteMany({ where: { versionId } });
  await tx.homePageCategoryTile.deleteMany({ where: { versionId } });
  await tx.homePageFeaturedProduct.deleteMany({ where: { versionId } });
  await tx.homePageBrandSpotlight.deleteMany({ where: { versionId } });
  await tx.homePageCampaignSpotlight.deleteMany({ where: { versionId } });
  await tx.homePagePromoOffer.deleteMany({ where: { versionId } });
  await tx.homePageTestimonial.deleteMany({ where: { versionId } });

  await tx.homePageHero.create({
    data: {
      versionId,
      eyebrow: "Tees Collection",
      titlePrefix: "Everyday style,",
      titleAccent: "ready now",
      titleSuffix: ".",
      body: "A production-safe demo homepage with real catalog records, stock, media, and purchase-ready variants.",
      primaryCtaLabel: "Shop the edit",
      primaryCtaHref: "/shop",
      backgroundImageUrl: media.hero,
      backgroundImageAlt: "Models wearing a curated fashion collection"
    }
  });

  await tx.homePageSectionHeader.createMany({
    data: Object.values(sectionHeaders).map((header) => ({
      versionId,
      ...header
    }))
  });

  await tx.homePageTrustBadge.createMany({
    data: [
      ["truck", "Fast delivery", "Configured for Ghana storefront testing", "/shipping"],
      ["shield", "Secure checkout", "Payments, sessions, and stock checks stay server-side", "/privacy"],
      ["sparkles", "Curated drops", "Homepage content is managed from admin CMS", "/shop"]
    ].map(([iconName, title, subtitle, href], index) => ({
      versionId,
      sortOrder: index,
      iconName,
      title,
      subtitle,
      href,
      ariaLabel: title
    }))
  });

  await tx.homePageCategoryTile.createMany({
    data: seeded.categories.map((category, index) => ({
      versionId,
      categoryId: category.id,
      sortOrder: index,
      slug: category.slug,
      title: category.name,
      description: "Published products available for storefront QA.",
      imageUrl: category.imageUrl
    }))
  });

  await tx.homePageFeaturedProduct.createMany({
    data: seeded.products.map((product, index) => ({
      versionId,
      productId: product.id,
      sortOrder: index
    }))
  });

  const atelierProducts = seeded.products.filter((product) => product.brandSlug === "tees-atelier");
  const brandSpotlight = await tx.homePageBrandSpotlight.create({
    data: {
      versionId,
      brandId: seeded.brands.find((brand) => brand.slug === "tees-atelier")?.id ?? null,
      sortOrder: 0,
      slug: "tees-atelier",
      title: "Tees Atelier",
      tagline: "Polished pieces for launch-ready outfits.",
      heroImageUrl: media.campaign,
      ctaLabel: "Shop Tees Atelier"
    }
  });
  await tx.homePageBrandSpotlightProduct.createMany({
    data: atelierProducts.map((product, index) => ({
      brandSpotlightId: brandSpotlight.id,
      productId: product.id,
      sortOrder: index
    }))
  });

  const campaignSpotlight = await tx.homePageCampaignSpotlight.create({
    data: {
      versionId,
      campaignId: seeded.campaign.id,
      sortOrder: 0,
      slug: seeded.campaign.slug,
      title: "New Season Essentials",
      subtitle: "A compact campaign block connected to live products.",
      heroImageUrl: media.campaign,
      label: "Live campaign",
      ctaLabel: "Shop the campaign",
      layout: "FEATURE"
    }
  });
  await tx.homePageCampaignSpotlightProduct.createMany({
    data: seeded.products.slice(0, 3).map((product, index) => ({
      campaignSpotlightId: campaignSpotlight.id,
      productId: product.id,
      sortOrder: index
    }))
  });

  const promo = await tx.homePagePromoOffer.create({
    data: {
      versionId,
      sortOrder: 0,
      badge: "Demo offer",
      code: "TEST10",
      headline: "Use TEST10 while validating checkout",
      body: "A storefront-ready promotion card for visual and flow testing.",
      terms: "Demo content only. Configure real coupon rules before launch.",
      bannerImageUrl: media.hero,
      ctaLabel: "Shop offer",
      ctaHref: "/shop"
    }
  });
  await tx.homePagePromoOfferProduct.createMany({
    data: seeded.products.slice(0, 2).map((product, index) => ({
      promoOfferId: promo.id,
      productId: product.id,
      sortOrder: index
    }))
  });

  await tx.homePageTestimonial.createMany({
    data: [
      {
        versionId,
        sortOrder: 0,
        quote: "The storefront now has enough real data for meaningful QA across homepage, catalog, and checkout.",
        customerName: "QA Shopper",
        imageUrl: media.testimonial,
        statusLabel: "Demo account"
      }
    ]
  });
};

const main = async () => {
  const published = await prisma.homePageVersion.findUnique({ where: { state: "PUBLISHED" } });
  if (published && !force) {
    console.log("Published homepage already exists; skipping demo homepage seed. Set FORCE_STOREFRONT_DEMO=1 to overwrite.");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const warehouse = await tx.warehouse.upsert({
      where: { code: "DEMO-MAIN" },
      update: { name: "Demo Main Warehouse", operationalStatus: "ACTIVE" },
      create: { code: "DEMO-MAIN", name: "Demo Main Warehouse", operationalStatus: "ACTIVE" }
    });

    const brandsBySlug = new Map();
    const categoriesBySlug = new Map();
    const seededProducts = [];

    for (const item of products) {
      const brand = await tx.brand.upsert({
        where: { slug: item.brand.slug },
        update: { name: item.brand.name, status: "ACTIVE" },
        create: { slug: item.brand.slug, name: item.brand.name, status: "ACTIVE" }
      });
      brandsBySlug.set(brand.slug, brand);

      const category = await tx.category.upsert({
        where: { slug: item.category.slug },
        update: { name: item.category.name, imageUrl: item.category.imageUrl, status: "ACTIVE" },
        create: {
          slug: item.category.slug,
          name: item.category.name,
          imageUrl: item.category.imageUrl,
          status: "ACTIVE"
        }
      });
      categoriesBySlug.set(category.slug, category);

      const product = await tx.product.upsert({
        where: { slug: item.slug },
        update: {
          title: item.title,
          description: item.description,
          brandId: brand.id,
          status: "PUBLISHED",
          merchandisingFeatured: true,
          merchandisingHomeHighlight: true,
          merchandisingSearchBoost: 25
        },
        create: {
          slug: item.slug,
          title: item.title,
          description: item.description,
          brandId: brand.id,
          status: "PUBLISHED",
          merchandisingFeatured: true,
          merchandisingHomeHighlight: true,
          merchandisingSearchBoost: 25
        }
      });

      const variant = await tx.productVariant.upsert({
        where: { sku: item.sku },
        update: {
          productId: product.id,
          attributes: item.attributes,
          priceAmountCents: item.priceAmountCents,
          compareAtPriceAmountCents: item.compareAtPriceAmountCents,
          priceCurrency: "GHS",
          status: "ACTIVE"
        },
        create: {
          productId: product.id,
          sku: item.sku,
          attributes: item.attributes,
          priceAmountCents: item.priceAmountCents,
          compareAtPriceAmountCents: item.compareAtPriceAmountCents,
          priceCurrency: "GHS",
          status: "ACTIVE"
        }
      });

      await tx.productCategory.upsert({
        where: { productId_categoryId: { productId: product.id, categoryId: category.id } },
        update: {},
        create: { productId: product.id, categoryId: category.id }
      });

      await tx.productMedia.deleteMany({ where: { productId: product.id } });
      await tx.productMedia.create({
        data: {
          productId: product.id,
          variantId: variant.id,
          url: item.imageUrl,
          storageProvider: "external",
          publicId: `demo/${item.slug}`,
          resourceType: "image",
          mimeType: "image/jpeg",
          kind: "IMAGE",
          sortOrder: 0,
          originalFilename: `${item.slug}.jpg`
        }
      });

      await tx.inventoryStock.upsert({
        where: { variantId_warehouseId: { variantId: variant.id, warehouseId: warehouse.id } },
        update: { onHand: item.stock, reserved: 0, reorderLevel: 5, status: "ACTIVE" },
        create: {
          variantId: variant.id,
          warehouseId: warehouse.id,
          onHand: item.stock,
          reserved: 0,
          reorderLevel: 5,
          status: "ACTIVE"
        }
      });

      seededProducts.push({ ...product, brandSlug: brand.slug });
    }

    const campaign = await tx.campaign.upsert({
      where: { slug: "the-winter-edit" },
      update: { name: "The Winter Edit", status: "ACTIVE" },
      create: { slug: "the-winter-edit", name: "The Winter Edit", status: "ACTIVE" }
    });
    await tx.campaign.upsert({
      where: { slug: "demo-new-season-essentials" },
      update: { name: "New Season Essentials", status: "ACTIVE" },
      create: { slug: "demo-new-season-essentials", name: "New Season Essentials", status: "ACTIVE" }
    });

    const existingBanner = await tx.banner.findFirst({
      where: { placement: "home_hero", title: "Tees Collection Demo Hero" }
    });
    if (existingBanner) {
      await tx.banner.update({
        where: { id: existingBanner.id },
        data: { status: "PUBLISHED", mediaUrl: media.hero, linkUrl: "/shop", sortOrder: 0 }
      });
    } else {
      await tx.banner.create({
        data: {
          placement: "home_hero",
          status: "PUBLISHED",
          sortOrder: 0,
          title: "Tees Collection Demo Hero",
          mediaUrl: media.hero,
          mediaStorageProvider: "external",
          mediaResourceType: "image",
          mediaMimeType: "image/jpeg",
          linkUrl: "/shop",
          campaignId: campaign.id
        }
      });
    }

    const versions = [];
    for (const state of ["DRAFT", "PUBLISHED"]) {
      const version = await tx.homePageVersion.upsert({
        where: { state },
        update: { publishedAt: state === "PUBLISHED" ? new Date() : null },
        create: { state, publishedAt: state === "PUBLISHED" ? new Date() : null }
      });
      await writeHomepageContent(tx, version.id, {
        products: seededProducts,
        brands: Array.from(brandsBySlug.values()),
        categories: Array.from(categoriesBySlug.values()),
        campaign
      });
      versions.push(version);
    }

    return {
      products: seededProducts.length,
      categories: categoriesBySlug.size,
      brands: brandsBySlug.size,
      campaign: campaign.slug,
      versions: versions.length
    };
  }, { maxWait: 15_000, timeout: 30_000 });

  console.log(`Seeded demo storefront: ${JSON.stringify(result)}`);
};

main()
  .catch((error) => {
    console.error("Demo storefront seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
