/**
 * Curated Unsplash URLs — cosmetics, fashion, sneakers.
 * Every `photo-*` id is verified HTTP 200 at build time (replace if Unsplash rotates).
 */
const p = (id: string, w: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=85&w=${w}`;

export const mockImages = {
  /** Cosmetics flatlay — clear product / beauty story */
  heroHome: p("1596462502278-27bfdc403348", 2400),
  heroAbout: p("1596462502278-27bfdc403348", 2000),
  aboutStory: p("1612817288484-6f916006741a", 1600),
  campaignWinter: p("1608231387042-66d1773070a5", 2000),
  campaignSummer: p("1571781926291-c477ebfd024b", 2000),
  campaignNew: p("1556228720-195a672e8a03", 2000),
  promoFirst: p("1620916566398-39f1143ab7be", 2000),
  promoPair: p("1483985988355-763728e1935b", 2000),
  catOuterwear: p("1515886657613-9f3515b0c78f", 1200),
  catFootwear: p("1542291026-7eec264c27ff", 1200),
  catBasics: p("1521572163474-6864f9cf17ab", 1200),
  catKnitwear: p("1441986300917-64674bd600d8", 1200),
  catEyewear: p("1572635196237-14b3f281503f", 1200),
  productP1: p("1483985988355-763728e1935b", 1200),
  productP2: p("1521572163474-6864f9cf17ab", 1200),
  productP3: p("1542291026-7eec264c27ff", 1200),
  productP4: p("1572635196237-14b3f281503f", 1200),
  productP5: p("1490481651871-ab68de25d43d", 1200),
  productP6: p("1434389677669-e08b4cac3105", 1200),
  productP7: p("1445205170230-053b83016050", 1200),
  /** Summit boot — was 404; working sneaker still */
  productP8: p("1552346154-21d32810aba3", 1200),
  /** Chelsea boot — was 404; working footwear still */
  productP9: p("1590874103328-eac38a683ce7", 1200),
  productP10: p("1556228578-0d85b1a4d571", 1200),
  order1: p("1522335789203-aabd1fc54bc9", 800),
  order2: p("1549298916-b41d501d3772", 800),
  order3: p("1586495777744-4413f21062fa", 800),
  checkoutA: p("1556228578-0d85b1a4d571", 1200),
  checkoutB: p("1515886657613-9f3515b0c78f", 1200),
  checkoutOrderA: p("1542291026-7eec264c27ff", 800),
  checkoutOrderB: p("1483985988355-763728e1935b", 800),
  authPanel: p("1612817288484-6f916006741a", 1600),
  authSlide1: p("1596462502278-27bfdc403348", 1600),
  authSlide2: p("1571781926291-c477ebfd024b", 1600),
  authSlide3: p("1549298916-b41d501d3772", 1600),
  testimonial1: p("1494790108377-be9c29b29330", 256),
  testimonial2: p("1507003211169-0a1dd7228f2d", 256),
  testimonial3: p("1438761681033-6461ffad8d80", 256),
} as const;
