import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StorefrontMain, StorefrontShell } from "@/components/layout";
import { ProductCard, StarRating, fieldClass, labelClass } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { allProducts, productsBySlug } from "@/lib/data/customer-mock";
import { useCustomerStore } from "@/lib/store/customer-store";

const ProductSubpageMissing = () => (
  <StorefrontShell>
    <StorefrontMain>
      <h1 className="text-2xl font-headline font-extrabold tracking-tighter mb-3">Product not found</h1>
      <p className="text-on-surface-variant text-sm mb-6">This item is not in our current catalogue.</p>
      <Link to="/shop" className="text-secondary font-bold text-sm uppercase tracking-widest hover:underline underline-offset-4">
        Browse shop
      </Link>
    </StorefrontMain>
  </StorefrontShell>
);

/* ── Subcategory (catalog: /categories/:cat/:sub) ── */
export const SubcategoryPage = () => {
  const { categorySlug, subcategorySlug } = useParams();
  const parent = categorySlug ?? "";
  const sub = (subcategorySlug ?? "").replace(/-/g, " ");
  const label = sub ? sub.charAt(0).toUpperCase() + sub.slice(1) : "Subcategory";
  const filtered = allProducts.filter((p) => {
    const cat = p.category.toLowerCase();
    const par = parent.toLowerCase();
    const subL = (subcategorySlug ?? "").toLowerCase().replace(/-/g, " ");
    return (
      cat.includes(par) ||
      par.includes(cat) ||
      p.name.toLowerCase().includes(subL) ||
      p.slug.toLowerCase().includes(subL)
    );
  });
  const list = filtered.length > 0 ? filtered : allProducts;

  return (
    <StorefrontShell>
      <StorefrontMain>
        <nav className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs font-label tracking-widest uppercase text-outline mb-6 md:mb-10">
          <Link className="hover:text-secondary transition-colors" to="/">
            Home
          </Link>
          <Icon name="chevron_right" className="text-[10px]" />
          <Link className="hover:text-secondary transition-colors" to={`/categories/${parent}`}>
            {parent}
          </Link>
          <Icon name="chevron_right" className="text-[10px]" />
          <span className="text-on-surface">{label}</span>
        </nav>
        <header className="mb-10 md:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline font-extrabold tracking-tighter text-on-background mb-4">
            {label}
          </h1>
          <p className="text-on-surface-variant">{list.length} pieces in this edit.</p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </StorefrontMain>
    </StorefrontShell>
  );
};

/* ── Product gallery fullscreen ── */
export const ProductGalleryPage = () => {
  const { productSlug } = useParams();
  const product = productSlug ? productsBySlug[productSlug] : undefined;
  if (!product) return <ProductSubpageMissing />;
  const imgs = [product.imageUrl, ...(product.images ?? [])].filter(Boolean);

  return (
    <StorefrontShell>
      <StorefrontMain>
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link
            to={`/products/${product.slug}`}
            className="inline-flex items-center gap-2 text-sm font-label font-bold uppercase tracking-widest text-secondary"
          >
            <Icon name="arrow_back" />
            Back to product
          </Link>
          <h1 className="font-headline font-bold text-lg truncate">{product.name}</h1>
        </div>
        <div className="space-y-6">
          {imgs.map((src, i) => (
            <div
              key={i}
              className="relative w-full aspect-[3/4] max-h-[85dvh] bg-surface-container-low rounded-xl overflow-hidden"
            >
              <img src={src} alt="" className="w-full h-full object-contain bg-black/5" />
            </div>
          ))}
        </div>
      </StorefrontMain>
    </StorefrontShell>
  );
};

const MOCK_REVIEWS = [
  { author: "Eleanor V.", rating: 5, date: "Nov 2024", title: "Investment quality", body: "Fabric and finish exceeded expectations. True atelier level." },
  { author: "Marcus T.", rating: 4, date: "Oct 2024", title: "Beautiful drape", body: "Slightly long in the sleeves for me but tailoring fixed it." },
  { author: "Sasha K.", rating: 5, date: "Sep 2024", title: "Perfect for travel", body: "Lightweight, wrinkle-resistant, and looks sharp." },
];

/* ── Product reviews ── */
export const ProductReviewsPage = () => {
  const { productSlug } = useParams();
  const product = productSlug ? productsBySlug[productSlug] : undefined;
  if (!product) return <ProductSubpageMissing />;
  const [filter, setFilter] = useState<"all" | "5" | "4">("all");
  const reviews = MOCK_REVIEWS.filter((r) => (filter === "all" ? true : String(r.rating) === filter));

  return (
    <StorefrontShell>
      <StorefrontMain>
        <Link to={`/products/${product.slug}`} className="inline-flex items-center gap-2 text-sm font-bold text-secondary mb-8">
          <Icon name="arrow_back" />
          {product.name}
        </Link>
        <header className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-extrabold tracking-tighter">Reviews</h1>
            <div className="flex items-center gap-2 mt-2">
              <StarRating rating={product.rating ?? 4} />
              <span className="text-sm text-outline">({product.reviewCount ?? 0} total)</span>
            </div>
          </div>
          <div className="flex gap-2">
            {(["all", "5", "4"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest ${
                  filter === f ? "bg-secondary text-on-secondary" : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {f === "all" ? "All" : `${f}★`}
              </button>
            ))}
          </div>
        </header>
        <ul className="space-y-6">
          {reviews.map((r, i) => (
            <li key={i} className="p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
              <div className="flex justify-between items-start gap-4 mb-3">
                <div>
                  <p className="font-headline font-bold">{r.title}</p>
                  <p className="text-xs text-outline">{r.author} · {r.date}</p>
                </div>
                <StarRating rating={r.rating} />
              </div>
              <p className="text-on-surface-variant leading-relaxed">{r.body}</p>
            </li>
          ))}
        </ul>
      </StorefrontMain>
    </StorefrontShell>
  );
};

/* ── Product Q&A ── */
export const ProductQuestionsPage = () => {
  const { productSlug } = useParams();
  const product = productSlug ? productsBySlug[productSlug] : undefined;
  if (!product) return <ProductSubpageMissing />;
  const [q, setQ] = useState("");

  return (
    <StorefrontShell>
      <StorefrontMain>
        <Link to={`/products/${product.slug}`} className="inline-flex items-center gap-2 text-sm font-bold text-secondary mb-8">
          <Icon name="arrow_back" />
          {product.name}
        </Link>
        <h1 className="text-3xl font-headline font-extrabold tracking-tighter mb-2">Questions</h1>
        <p className="text-on-surface-variant mb-8 text-sm">Ask our concierge; answers post within 1–2 business days.</p>
        <form
          className="space-y-4 mb-12 p-6 bg-surface-container-low rounded-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            setQ("");
          }}
        >
          <div>
            <label className={labelClass} htmlFor="pq">
              Your question
            </label>
            <textarea
              id="pq"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={`${fieldClass} min-h-[120px]`}
              placeholder="e.g. Is this true to size?"
              required
            />
          </div>
          <button type="submit" className="w-full sm:w-auto bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold text-sm uppercase tracking-widest">
            Submit question
          </button>
        </form>
        <div className="space-y-6">
          {[
            { q: "Is this piece lined?", a: "Yes — full cupro lining in the body.", who: "Tees Support" },
            { q: "Machine washable?", a: "We recommend dry clean only to preserve the wool finish.", who: "Tees Support" },
          ].map((item, i) => (
            <div key={i} className="border-b border-outline-variant/20 pb-6">
              <p className="font-headline font-bold mb-2">{item.q}</p>
              <p className="text-on-surface-variant text-sm mb-2">{item.a}</p>
              <p className="text-xs text-outline uppercase tracking-widest">{item.who}</p>
            </div>
          ))}
        </div>
      </StorefrontMain>
    </StorefrontShell>
  );
};

/* ── Saved items + recently viewed (catalog /saved-items) ── */
export const SavedItemsPage = () => {
  const wishlist = useCustomerStore((s) => s.wishlist);
  const recentSlugs = useCustomerStore((s) => s.recentlyViewedProductSlugs);
  const clearRecent = useCustomerStore((s) => s.clearRecentlyViewed);
  const wishItems = allProducts.filter((p) => wishlist.includes(p.id));
  const recentItems = recentSlugs.map((slug) => productsBySlug[slug]).filter(Boolean);

  return (
    <StorefrontShell>
      <StorefrontMain>
        <header className="mb-10 md:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline font-extrabold tracking-tighter mb-4">Saved & recent</h1>
          <p className="text-on-surface-variant max-w-xl text-sm sm:text-base">
            Wishlist pieces and products you have browsed recently on this device.
          </p>
        </header>

        <section className="mb-16">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="font-headline text-xl font-bold">Recently viewed</h2>
            {recentItems.length > 0 && (
              <button
                type="button"
                onClick={() => clearRecent()}
                className="text-xs font-bold uppercase tracking-widest text-outline hover:text-secondary self-start"
              >
                Clear history
              </button>
            )}
          </div>
          {recentItems.length === 0 ? (
            <p className="text-on-surface-variant text-sm py-12 text-center bg-surface-container-low rounded-2xl">
              No recent items yet. Browse the{" "}
              <Link to="/shop" className="text-secondary font-bold underline underline-offset-4">
                shop
              </Link>
              .
            </p>
          ) : (
            <div className="flex overflow-x-auto no-scrollbar gap-4 pb-2 snap-x">
              {recentItems.map((p) =>
                p ? (
                  <div key={p.slug} className="flex-shrink-0 w-44 snap-start">
                    <ProductCard product={p} />
                  </div>
                ) : null
              )}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-headline text-xl font-bold">Wishlist</h2>
            <Link to="/wishlist" className="text-xs font-bold uppercase tracking-widest text-secondary">
              Open full wishlist
            </Link>
          </div>
          {wishItems.length === 0 ? (
            <p className="text-on-surface-variant text-sm py-12 text-center bg-surface-container-low rounded-2xl">
              Nothing saved. Tap the heart on any product to add it here.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
              {wishItems.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </StorefrontMain>
    </StorefrontShell>
  );
};
