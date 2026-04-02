export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  images?: string[];
  badge?: string;
  rating?: number;
  reviewCount?: number;
  description?: string;
  colorVariants?: { name: string; hex: string }[];
  sizes?: string[];
  outOfStockSizes?: string[];
  inStock?: boolean;
  brand?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: "Processing" | "Shipped" | "Delivered" | "Cancelled" | "Returned";
  createdAt: string;
  total: number;
  items: { name: string; imageUrl: string; price: number; qty: number; variant?: string }[];
}

export interface SupportTicket {
  id: string;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  createdAt: string;
  lastReply: string;
  messages: { sender: "customer" | "support"; body: string; time: string }[];
}

/* ── Products ── */
export const featuredProducts: Product[] = [
  {
    id: "p1",
    slug: "heritage-wool-overcoat",
    name: "Heritage Wool Overcoat",
    category: "Outerwear",
    price: 450.0,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAd9OZgJzQcF1i4XkuFSLINMyli6B8NHK8RLDLp2pqIHFXzVKoooKWtKRqQpDIqq397qa3W2EipH-d8FNidqSItkShSHMxGduqulenCFgekYlxUPVpHJZE8GoZE3imqIwIwrT5VmrZsrd41lfjVOKDVVU3c7y21bCG1iCgyAcLKD-cLAiw7cLsyv-cxt2R6lqCmxGUsJhzEWz841kyWvOARLPNWn0X4h_PvOxGtu4U0vrCqhv_htPtY-3UNybpn-OZrJas-TKoC24Zb",
    badge: "New Arrival",
    rating: 4,
    reviewCount: 48,
    description:
      "Crafted from 100% Italian virgin wool, this architectural overcoat features a structured silhouette with bespoke horn buttons.",
    colorVariants: [
      { name: "Deep Camel", hex: "#C19A6B" },
      { name: "Midnight Black", hex: "#1A1A1A" },
      { name: "Forest Green", hex: "#4A5D4E" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    outOfStockSizes: ["L"],
    inStock: true,
    brand: "Tees",
  },
  {
    id: "p2",
    slug: "organic-cotton-tee",
    name: "Organic Cotton Tee",
    category: "Basics",
    price: 68.0,
    originalPrice: 85.0,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD45A2gMDbqYiKXLsq83JsSGxUEhh8fQ0w4YtPs82toBDoRKzQbibELV0dxlMBa5xTcPR1MkRFZXhMax2RavCM_R7Pm9Z8sg0Mzta_jlA20TDtq-cPxA5P-Wb96lrdaQphMPJsttDFUcMuXQezZCThCtKicPhPM6aupwfpC9WEfvyQT6ZjNL6pV0y3u6VE-hSzLR2CuVngxftNbZKGpoJrzNtUi6fcDKxAq_BvyY2A9SwWOgK_jAmW-zhBBd84Chs5FrwGpjEIYN_Bi",
    badge: "-20%",
    rating: 5,
    reviewCount: 124,
    description: "Breathable GOTS-certified organic cotton. Minimal silhouette, maximal comfort.",
    colorVariants: [
      { name: "Optic White", hex: "#FFFFFF" },
      { name: "Stone Grey", hex: "#8C8C8C" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
    brand: "Nord Form",
  },
  {
    id: "p3",
    slug: "velocity-trainer",
    name: "Velocity Trainer",
    category: "Footwear",
    price: 185.0,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCPcMkNmrM9O6wOqB9l449CkRbzVObEMvr2aaLIPGcYbBbZmt7QgVc31NNe3DOCaq4w-H4F2duq76Xroyth-spwnzXlJU6gwrzChB64w2oR-4kZy-p45ZNmBi-uLPicy95CBlKK7JgT4krmGX12SiXE0OzcgcDUmZhEdciffVxF6MlGPnXFyHXih4iVFohidhX3ZL5kefj6Jgfweab_sV9nooODoriFCWZxGMQ2cKXLprgMBPKfamUpF_8lXTwET2kbQgzD5a3QZlb5",
    rating: 5,
    reviewCount: 89,
    description: "Technical performance meets refined aesthetic in this award-winning trainer.",
    sizes: ["40", "41", "42", "43", "44", "45"],
    colorVariants: [{ name: "Signal Red", hex: "#CC2200" }],
    inStock: true,
    brand: "Maison Linea",
  },
  {
    id: "p4",
    slug: "horizon-spectacles",
    name: "Horizon Spectacles",
    category: "Eyewear",
    price: 210.0,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAVzrV-UVmJVNz7ptoMDAQ7m7DugQGOuqs0lO83AEu5Ct5TP_Mjo8nQ-ty_Mo4X_Cu1nMOnMI2AgiUEu7Z8wFExs5WqSocxD8G0EHhjs0w4v1Lknys2jmwwoBplvXWfjUqpl81LHDIhRQUOzgzT5GEX65YCCgrKL1XYWNsDmRkMueDrge07quHe-IY5XuAsnZJlbiy8sJchTPv6sCjiQswUErzvTlLqZxGKPcCljlvcgnnJ14ZbuIvWaPZbKNzYdM_mMHQprCzT4Da-",
    badge: "Editor's Pick",
    rating: 4,
    reviewCount: 32,
    description: "Titanium-framed editorial sunglasses for the discerning modernist.",
    colorVariants: [{ name: "Graphite", hex: "#3D3D3D" }],
    inStock: true,
    brand: "Tees",
  },
  {
    id: "p5",
    slug: "the-sculpted-trench",
    name: "The Sculpted Trench",
    category: "Luxury Wear",
    price: 890.0,
    originalPrice: 1240.0,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC_iajTZFt8CfKLC0CEj0DCTfn2t9bLeOeynsXBqG3X1tccZeKG6HiuGl6-iCCdn8u8-Kx-SnMeurLhB-wYU0uc7ic5A08spkd8ZV0nHuwXYmtZ7gPDb1lwFAT_vSqjgsRUNGjb9BWeMEwx_a9xNKcby4qNIdjigOKo7tisK4YaKuWhrAAW2Ziu9G67OAYz2xsqPeryDBmU6M1PO5VwLojKCjqTBFNP__FD0GeTya-yORyXd0VBDhIFSaTOwY8wiQ1F1C_4X9Xtei4q",
    badge: "New Collection",
    rating: 4,
    reviewCount: 42,
    description:
      "An architectural masterpiece crafted from Italian double-faced wool, featuring a structured silhouette and bespoke horn buttons.",
    colorVariants: [
      { name: "Deep Camel", hex: "#C19A6B" },
      { name: "Midnight Black", hex: "#1A1A1A" },
      { name: "Forest Green", hex: "#4A5D4E" },
    ],
    sizes: ["XS", "S", "M", "L"],
    outOfStockSizes: ["L"],
    inStock: true,
    brand: "Tees",
  },
  {
    id: "p6",
    slug: "merino-shell-layer",
    name: "Merino Shell Layer",
    category: "Knitwear",
    price: 185.0,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDgUBOnNqUXEeljr3SDN4gmqzRc-RE1maUDD6ppfY82-A6JpO5KKdvGoBqwVbeoGjLqk6XmYxOxPFJ_RTgXFa6bcuTzkclllzByJEtEwG7SZJ8jUUiAqijoid63ybucQH3X64p0sc9hWhEVfOLyTZpWQLJy5RTXvfkFFXVOQNwd0JST80waooYRF3W4M8ujFhBh2ucsdcp7Tei8Ctx5LvALZu9_zil_PViVyy12vfT7SIboRQhWSTQM3ivKHOi-8guIZV6rRJkXE6",
    rating: 5,
    reviewCount: 60,
    description: "100% Merino wool knit layer – perfect base for a capsule wardrobe.",
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
    brand: "Nord Form",
  },
  {
    id: "p7",
    slug: "nordic-parka-v2",
    name: "Nordic Parka v2",
    category: "Outerwear",
    price: 450.0,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA3J0-WKHZSTrwvhVIeVkJn0xX7PbbEMZO9cZddF5YISOcalOEomybdAFEaBT8vCfAbNv2be829O1uCHnJKrRoGj3BBZALdlhRHzyiGofDOF_tDDn4ji8qGxa3-xUo6jkdHbqVBLAdZ7MyU6rGmwshgQG0MVL3i5iwavBnLyOXk1Mx4nGRMGqyXMIltFfFxNBtYNGdTt-RzQHVRz9nqLL6qtFdp5q3nkbgO2Ait3gXnQtCSQiLzTbVA7F9jUJZXeYfshrQMvgG4-QsS",
    rating: 4,
    reviewCount: 28,
    description: "Technical waterproof shell with insulated inner lining.",
    sizes: ["S", "M", "L", "XL"],
    inStock: true,
    brand: "Tees",
  },
  {
    id: "p8",
    slug: "the-summit-boot",
    name: "The Summit Boot",
    category: "Footwear",
    price: 320.0,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCVLBTr8sxtNCte6PpWkHeVGFs10OwXS7t0OSveRLbfVQj1ScgqMIuu8K9owXUcNcoOL831S3kC1vLETdofV4s3E_bcF2Ryrmhj8PJe2MXMRdF3L1FYltZEa4HEVs1zPKQ5wLib9-tCSpRSnJzAlG3MC9D18z7Bm-gwRddDkq4HiYmffzf8qKqXdk0Bwh4Ifm_bPlCo5M7juz1E7vPzWff-9r_6eYeF9BdmOGcKcB3k3bFqyYuj-Ou9uXiJBebi5v5KtGkAS9-oE7Bw",
    rating: 5,
    reviewCount: 44,
    description: "Premium brown leather boots — constructed to last decades.",
    sizes: ["40", "41", "42", "43", "44"],
    inStock: true,
    brand: "Maison Linea",
  },
];

export const allProducts: Product[] = [
  ...featuredProducts,
  {
    id: "p9",
    slug: "essential-chelsea-boot",
    name: "Essential Chelsea Boot",
    category: "Footwear",
    price: 450.0,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCEHdjPb7Tr7TyfPqLXXkz_rsLXhPtJCYD09r1fIXxG04rykMwNroaWIingz_9Dw2TwniWwTj50heZoETfiVSLDOFk3TKPUQAzdbMjaPsrQndea48sIBE6esBwJ6ndS-GOrhOlDdwhdXHYBwdRmNHMqGiPcORNNrCqQse-v_0XRAeyV_k3nB6C9dlsF_mvOIEA2x1X4t5PtOQqldq8kXd1HIx2dR7Ecl8WhzjEA1pWXfJ9u-ScqHvp7xZE7NYYHVxYnDN1mXpP2QApE",
    rating: 4,
    reviewCount: 16,
    description: "Matte obsidian chelsea boot — the capsule wardrobe essential.",
    sizes: ["40", "41", "42", "43", "44"],
    inStock: true,
    brand: "Maison Linea",
  },
  {
    id: "p10",
    slug: "cashmere-blend-tee",
    name: "Cashmere Blend Tee",
    category: "Basics",
    price: 125.0,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB7V3dAdzfU2_j4rDBcCN0dzhtlV30cHoNEKqs2wRkp3jHm2G8Iz7jdAJPhKRIkMYTs4bSPpmpHAkylB0Dp5El3jE79mLw43bvjDRVWAcQrU435BKKerWdZ4NcsIwor-xMMued2sJAqFCw4ad_5oglK1DX1CbhXqJuevyXkIi0INs1cLnZvX5PP5swnsYIwxgRUFDEYZ5u2KffwLu6eOcEnuoa_NayGCdzkNPzoDPjoWwKRzJOvqa3u-lnci6TCqHDW7inA4zAn90p",
    rating: 5,
    reviewCount: 89,
    description: "Luxurious cashmere-cotton blend tee with a clean contemporary drape.",
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
    brand: "Nord Form",
  },
];

export type BrandDirectoryEntry = {
  slug: string;
  name: string;
  tagline: string;
  story: string;
  heroImage: string;
};

export const brandDirectory: BrandDirectoryEntry[] = [
  {
    slug: "tees",
    name: "Tees",
    tagline: "Our in-house cuts, fabrics, and everyday staples.",
    story:
      "Tees is the house line for Tees collection: premium cottons, reliable fits, and graphics you will want to wear weekly. Designed for comfort first, finished with the details that matter.",
    heroImage: featuredProducts[0].imageUrl,
  },
  {
    slug: "nord-form",
    name: "Nord Form",
    tagline: "Quiet basics and knit layers from the northern studio.",
    story:
      "Nord Form focuses on organic fibres, calm palettes, and pieces that anchor a wardrobe without shouting. Designed in Copenhagen, made with certified mills across Europe.",
    heroImage: featuredProducts[1].imageUrl,
  },
  {
    slug: "maison-linea",
    name: "Maison Linea",
    tagline: "Performance footwear and movement-led design.",
    story:
      "Maison Linea bridges technical soles with studio-grade leathers. Every last is tested for city miles, then refined until the line reads clean from studio to street.",
    heroImage: featuredProducts[2].imageUrl,
  },
];

export const brandDirectoryBySlug: Record<string, BrandDirectoryEntry> = Object.fromEntries(
  brandDirectory.map((b) => [b.slug, b])
);

export function brandSlugFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "tees"
  );
}

export const productsBySlug: Record<string, Product> = Object.fromEntries(
  allProducts.map((p) => [p.slug, p])
);

/* ── Orders ── */
export const orders: Order[] = [
  {
    id: "ord-1",
    orderNumber: "TC-88291",
    status: "Processing",
    createdAt: "November 14, 2023",
    total: 1250.0,
    items: [
      {
        name: "Tees Signature Heavyweight Tee",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAvRQmiMcf17y9SfZVtjonRKD1lPs5LnpF6NQ5adMtBxPKNj_YgSyz759x4kzoYYYOfooMRqJnLrv74Seq3tK2SkpK0dUogrsLIepQXf9KEUOmCCi22L5b-H64-_2I_Nv9p7zgCVbsEXnW1lIm6m1r9G7TNpmutoTpqtQ1iHe699zkmDWGjMQmsjka5dVCCKqoR4rwxB2ON4Bj5TB0z2HXJmeWqcty8WagYmv3hYrO-62HAOTa6bgauJ1vPExJLAwK7NCBsR8HPGR-R",
        price: 1250.0,
        qty: 1,
      },
    ],
  },
  {
    id: "ord-2",
    orderNumber: "TC-88104",
    status: "Shipped",
    createdAt: "November 02, 2023",
    total: 499.0,
    items: [
      {
        name: "Acoustic Studio Over-Ear",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDrf5fF-U3t3U5IkwRqqAYEZDEEXDr8xVYoJHoJMnZhcXS9a_WTLlq01rq_ZavmGUO0wK4UDpH48jAwNX2gJKpzz_LGIwTUUapxikO-LjevvQSDIIHS3pIcLXtVFlo63og_y6ORV6Lv6TAu4TBXdr0YQeuDKRRLi5Fa_JEh2EJX7KqNDZMiNt3_SSNYQtSISpLg6Uonm-Fqb948VbxlvBXXbLAMWzzUoDtTxKuWHjp7LD4SX1uWLRYCxLzMCHz6246DYdp62NPRJlqj",
        price: 499.0,
        qty: 1,
      },
    ],
  },
  {
    id: "ord-3",
    orderNumber: "TC-87955",
    status: "Delivered",
    createdAt: "October 15, 2023",
    total: 185.0,
    items: [
      {
        name: "Heirloom Leather Journal Set",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDektpKxh71m-NdCFbUu_nPLcMJxQNSIBgCevKzsunKKZXVJRRpEuH-qivBl90ViWHov2SS2P1mCu2U25Bo9v-0XafX61I1gkU79qkHRs5qglpsBFNjYVzy9qFhgFTsnPwqDh8AGeOfHZX7bL0T4g82LQ-Xm71t0dLoNROtFGmy-A3g2p13rr1jNpBlxZ9MoyOPZkrMNlquGB86Ea_-5dIybtGd1O9e2lwU1F4qgw46QoaTxqqIULTycmMP6R2zrrEY1Mll6V_-FPTU",
        price: 185.0,
        qty: 1,
      },
    ],
  },
];

/* ── Support Tickets ── */
export const tickets: SupportTicket[] = [
  {
    id: "tkt-1",
    subject: "Late delivery for order #TC-88291",
    status: "open",
    createdAt: "Nov 15, 2023",
    lastReply: "Nov 16, 2023",
    messages: [
      {
        sender: "customer",
        body: "My order was supposed to arrive on the 13th. It still hasn't arrived.",
        time: "Nov 15, 10:03 AM",
      },
      {
        sender: "support",
        body: "We sincerely apologize. We've escalated this with our courier. Expect an update within 24 hours.",
        time: "Nov 15, 2:14 PM",
      },
    ],
  },
  {
    id: "tkt-2",
    subject: "Wrong size received for Organic Cotton Tee",
    status: "resolved",
    createdAt: "Oct 20, 2023",
    lastReply: "Oct 21, 2023",
    messages: [
      {
        sender: "customer",
        body: "I ordered size M but received size L.",
        time: "Oct 20, 11:30 AM",
      },
      {
        sender: "support",
        body: "We've sent a replacement in size M via express. Return label has been emailed to you.",
        time: "Oct 21, 9:45 AM",
      },
    ],
  },
];

/* ── Campaigns ── */
export const campaigns = [
  {
    slug: "the-winter-edit",
    title: "The Winter Edit",
    subtitle: "Cold-weather layers and footwear — up to 40% off selected lines while supplies last.",
    heroImageUrl:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=85&w=2000",
    products: ["heritage-wool-overcoat", "the-sculpted-trench", "nordic-parka-v2", "the-summit-boot"],
  },
  {
    slug: "summer-edit-2024",
    title: "The Summer Edit",
    subtitle: "Refined essentials for warm-weather living.",
    heroImageUrl:
      "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&q=85&w=2000",
    products: ["organic-cotton-tee", "merino-shell-layer", "velocity-trainer"],
  },
  {
    slug: "new-arrivals",
    title: "New Arrivals",
    subtitle: "Just landed — the latest pieces from our winter collection.",
    heroImageUrl:
      "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&q=85&w=2000",
    products: ["heritage-wool-overcoat", "the-sculpted-trench", "nordic-parka-v2"],
  },
];

export type CampaignEntry = (typeof campaigns)[number];

export function campaignBySlug(slug: string | undefined): CampaignEntry | undefined {
  if (!slug) return undefined;
  return campaigns.find((c) => c.slug === slug);
}

export function productsFromSlugs(slugs: string[]): Product[] {
  return slugs.map((s) => productsBySlug[s]).filter((p): p is Product => Boolean(p));
}

export function countProductsInCategoryKeyword(keyword: string): number {
  const k = keyword.toLowerCase();
  return allProducts.filter((p) => p.category.toLowerCase().includes(k)).length;
}

export function productsForBrandSlug(brandSlug: string, limit = 4): Product[] {
  return allProducts.filter((p) => brandSlugFromName(p.brand ?? "") === brandSlug).slice(0, limit);
}

/** Homepage category tiles — `slug` is matched against `Product.category` (substring). */
export const homeCategoryTiles = [
  {
    slug: "outerwear",
    title: "Outerwear",
    description: "Coats, trenches & parkas",
    imageUrl:
      "https://images.unsplash.com/photo-1571875257727-256c39da42af?auto=format&fit=crop&q=80&w=1200",
  },
  {
    slug: "footwear",
    title: "Footwear",
    description: "Leather, boots & trainers",
    imageUrl:
      "https://images.unsplash.com/photo-1583241803100-ec28d1801aec?auto=format&fit=crop&q=80&w=1200",
  },
  {
    slug: "basics",
    title: "Basics",
    description: "Organic cotton & tees",
    imageUrl:
      "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&q=80&w=1200",
  },
  {
    slug: "knitwear",
    title: "Knitwear",
    description: "Merino & shell layers",
    imageUrl:
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=1200",
  },
  {
    slug: "eyewear",
    title: "Eyewear",
    description: "Optical & editorial sun",
    imageUrl:
      "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=1200",
  },
];

export type HomeCouponPromo = {
  id: string;
  code: string;
  badge: string;
  headline: string;
  body: string;
  terms: string;
  bannerImageUrl: string;
  productSlugs: string[];
  ctaLabel: string;
  ctaTo: string;
};

export const homeCouponPromos: HomeCouponPromo[] = [
  {
    id: "first-edit",
    code: "EDIT15",
    badge: "First purchase",
    headline: "15% off your first full-price order",
    body: "Authentic materials, insured delivery, and 30-day returns — the same standard on every order.",
    terms: "Applies to orders over $150. Excludes sale and campaign SKUs. One use per customer.",
    bannerImageUrl:
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=85&w=2000",
    productSlugs: ["organic-cotton-tee", "heritage-wool-overcoat", "horizon-spectacles"],
    ctaLabel: "Browse eligible edit",
    ctaTo: "/shop",
  },
  {
    id: "layer-pair",
    code: "LAYER20",
    badge: "Pair & save",
    headline: "$20 off knit + outerwear together",
    body: "Build a considered kit: one knit layer and one outer piece — shipped in our archival packaging.",
    terms: "Mock storefront: code shown for UX preview; applied at checkout when both categories are in cart.",
    bannerImageUrl:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=85&w=2000",
    productSlugs: ["merino-shell-layer", "heritage-wool-overcoat", "the-sculpted-trench"],
    ctaLabel: "Shop the pairing",
    ctaTo: "/shop",
  },
];

/* ── Static Page Content ── */
export const pages = {
  shipping: {
    title: "Shipping Policy",
    sections: [
      { heading: "Standard Delivery", body: "We ship all domestic orders within 1–2 business days. Standard delivery takes 3–5 business days after dispatch." },
      { heading: "Express Delivery", body: "Express next-day delivery is available for orders placed before 2pm (Mon–Fri). Additional fee of $15 applies." },
      { heading: "International Shipping", body: "We ship to 40+ countries. International orders take 5–10 business days. Customs duties and taxes are the responsibility of the recipient." },
      { heading: "Free Shipping", body: "Complimentary standard shipping on all orders over $200." },
    ],
  },
  returns: {
    title: "Returns Policy",
    sections: [
      { heading: "30-Day Returns", body: "You may return any item within 30 days of delivery for a full refund, provided items are in their original condition with tags attached." },
      { heading: "How to Return", body: "Log into your account, navigate to Orders, and select 'Request a Return'. We'll email you a prepaid return label." },
      { heading: "Refund Timeline", body: "Refunds are processed within 2–3 business days of us receiving your return. Bank processing may take an additional 3–5 days." },
      { heading: "Non-Returnable Items", body: "Intimates, swimwear, and personalised items cannot be returned for hygiene and customisation reasons." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      { heading: "Data We Collect", body: "We collect information you provide directly, such as name, email, and shipping address. We also collect usage data to improve your experience." },
      { heading: "How We Use Your Data", body: "Your data is used to process orders, personalise your experience, and send communications you've opted into." },
      { heading: "Third Parties", body: "We do not sell your data. We share data only with trusted partners (e.g., Paystack for payments, delivery carriers) as necessary to fulfil your orders." },
      { heading: "Your Rights", body: "You have the right to access, correct, or delete your personal data at any time. Contact privacy@teescollection.com to exercise these rights." },
    ],
  },
  terms: {
    title: "Terms & Conditions",
    sections: [
      { heading: "Acceptance of Terms", body: "By using our website or placing an order, you agree to these terms and conditions." },
      { heading: "Products", body: "We make every effort to display our products as accurately as possible. Colours may vary slightly due to screen calibration." },
      { heading: "Pricing", body: "All prices are in USD and inclusive of applicable taxes unless stated otherwise. We reserve the right to change prices at any time." },
      { heading: "Governing Law", body: "These terms are governed by the laws of the State of New York, without regard to conflict-of-law principles." },
    ],
  },
};

/* ── FAQ ── */
export const faqItems = [
  { question: "How long does shipping take?", answer: "Standard delivery takes 3-5 business days. Express is next-day." },
  { question: "What is your return policy?", answer: "You can return any item within 30 days of delivery for a full refund." },
  { question: "Do you ship internationally?", answer: "Yes. We ship to over 40 countries. Customs duties may apply." },
  { question: "How do I track my order?", answer: "Once shipped, you will receive a tracking link via email." },
  { question: "Can I change or cancel an order?", answer: "Orders can be cancelled within 1 hour of placement. After that, initiate a return once received." },
  { question: "How do I contact support?", answer: "Via our help center, live chat (Mon–Fri 9am–6pm), or email at support@teescollection.com." },
];
