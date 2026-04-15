import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { StorefrontMain, StorefrontShell } from "@/components/layout";
import { ProductCard, StarRating, fieldClass, labelClass } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { customerBackendApi } from "@/lib/api/customer-backend-api";
import { CommerceApiError } from "@/lib/api/commerce-fetch";
import { mapPublicProductDetailToProduct, mapStorefrontProductCards, mapWishlistApiItemToProduct } from "@/lib/catalog/storefront-mappers";
import type { Product } from "@/lib/data/customer-mock";
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
  const q = [parent, sub].filter(Boolean).join(" ").trim();

  const searchQuery = useQuery({
    queryKey: ["customer-subcategory", q],
    queryFn: async () => {
      const { data } = await customerBackendApi.searchProducts({ q, page: 1, page_size: 48 });
      return mapStorefrontProductCards(data.items ?? []);
    },
    enabled: Boolean(q),
    staleTime: 30_000
  });

  const list = searchQuery.data ?? [];

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
          <p className="text-on-surface-variant">
            {searchQuery.isPending ? "Loading…" : `${list.length} pieces in this edit.`}
          </p>
        </header>
        {searchQuery.isError ? (
          <p className="text-error text-sm">Could not load this edit.</p>
        ) : searchQuery.isPending ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-sm bg-surface-container-high" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
            {list.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </StorefrontMain>
    </StorefrontShell>
  );
};

/* ── Product gallery fullscreen ── */
export const ProductGalleryPage = () => {
  const { productSlug } = useParams();
  const detailQuery = useQuery({
    queryKey: ["customer-product-detail", productSlug],
    queryFn: async () => {
      const { data } = await customerBackendApi.getProduct(productSlug!);
      return data;
    },
    enabled: Boolean(productSlug),
    staleTime: 60_000
  });

  const product = useMemo(
    () => (detailQuery.data ? mapPublicProductDetailToProduct(detailQuery.data) : null),
    [detailQuery.data]
  );

  const imgs = useMemo(() => {
    if (!detailQuery.data || typeof detailQuery.data !== "object") return [] as string[];
    const media = (detailQuery.data as { media?: Array<{ url?: string | null }> }).media ?? [];
    return media.map((m) => m.url).filter((u): u is string => Boolean(u?.trim()));
  }, [detailQuery.data]);

  if (detailQuery.isPending) {
    return (
      <StorefrontShell>
        <StorefrontMain>
          <p className="text-on-surface-variant py-24 text-center">Loading gallery…</p>
        </StorefrontMain>
      </StorefrontShell>
    );
  }

  if (detailQuery.isError || !product) return <ProductSubpageMissing />;

  const gallery = imgs.length > 0 ? imgs : [product.imageUrl];

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
          {gallery.map((src, i) => (
            <div
              key={i}
              className="relative w-full aspect-[3/4] max-h-[85dvh] bg-surface-container-low rounded-xl overflow-hidden"
            >
              <img src={src} alt="" className="w-full h-full object-contain bg-black/5" loading="lazy" decoding="async" />
            </div>
          ))}
        </div>
      </StorefrontMain>
    </StorefrontShell>
  );
};

type ApiReview = { id?: string; rating?: number; body?: string; createdAt?: string; authorName?: string };

/* ── Product reviews ── */
export const ProductReviewsPage = () => {
  const { productSlug } = useParams();
  const [filter, setFilter] = useState<"all" | "5" | "4">("all");

  const productQuery = useQuery({
    queryKey: ["customer-product-detail", productSlug],
    queryFn: async () => {
      const { data } = await customerBackendApi.getProduct(productSlug!);
      return data;
    },
    enabled: Boolean(productSlug),
    staleTime: 60_000
  });

  const reviewsQuery = useQuery({
    queryKey: ["customer-product-reviews", productSlug],
    queryFn: async () => {
      const { data } = await customerBackendApi.listProductReviews(productSlug!, 1, 50);
      return data.items as ApiReview[];
    },
    enabled: Boolean(productSlug) && productQuery.isSuccess,
    staleTime: 30_000
  });

  const product = useMemo(
    () => (productQuery.data ? mapPublicProductDetailToProduct(productQuery.data) : null),
    [productQuery.data]
  );

  if (productQuery.isPending) {
    return (
      <StorefrontShell>
        <StorefrontMain>
          <p className="text-on-surface-variant py-24 text-center">Loading…</p>
        </StorefrontMain>
      </StorefrontShell>
    );
  }

  if (productQuery.isError || !product) return <ProductSubpageMissing />;

  const rawReviews = reviewsQuery.data ?? [];
  const reviews = rawReviews.filter((r) => (filter === "all" ? true : String(r.rating) === filter));

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
        {reviewsQuery.isPending ? (
          <p className="text-on-surface-variant">Loading reviews…</p>
        ) : reviewsQuery.isError ? (
          <p className="text-error text-sm">Reviews could not be loaded.</p>
        ) : (
          <ul className="space-y-6">
            {reviews.map((r) => {
              const title =
                typeof r.body === "string" && r.body.trim().length > 0
                  ? r.body.trim().split("\n")[0]!.slice(0, 80)
                  : "Review";
              const date =
                typeof r.createdAt === "string"
                  ? new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
                  : "";
              return (
                <li key={r.id ?? title} className="p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div>
                      <p className="font-headline font-bold">{title}</p>
                      <p className="text-xs text-outline">
                        {r.authorName ?? "Customer"}
                        {date ? ` · ${date}` : ""}
                      </p>
                    </div>
                    <StarRating rating={typeof r.rating === "number" ? r.rating : 0} />
                  </div>
                  <p className="text-on-surface-variant leading-relaxed">{r.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </StorefrontMain>
    </StorefrontShell>
  );
};

/* ── Product Q&A ── */
export const ProductQuestionsPage = () => {
  const { productSlug } = useParams();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const productQuery = useQuery({
    queryKey: ["customer-product-detail", productSlug],
    queryFn: async () => {
      const { data } = await customerBackendApi.getProduct(productSlug!);
      return data;
    },
    enabled: Boolean(productSlug),
    staleTime: 60_000
  });

  const questionsQuery = useQuery({
    queryKey: ["customer-product-questions", productSlug],
    queryFn: async () => {
      const { data } = await customerBackendApi.getProductQuestions(productSlug!);
      return data as { entity?: { questions?: Array<{ id?: string; question: string; answer: string }> } };
    },
    enabled: Boolean(productSlug) && productQuery.isSuccess,
    staleTime: 30_000
  });

  const product = useMemo(
    () => (productQuery.data ? mapPublicProductDetailToProduct(productQuery.data) : null),
    [productQuery.data]
  );

  if (productQuery.isPending) {
    return (
      <StorefrontShell>
        <StorefrontMain>
          <p className="text-on-surface-variant py-24 text-center">Loading…</p>
        </StorefrontMain>
      </StorefrontShell>
    );
  }

  if (productQuery.isError || !product || !productSlug) return <ProductSubpageMissing />;

  const qaItems = questionsQuery.data?.entity?.questions ?? [];

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
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitErr(null);
            setSubmitOk(false);
            setBusy(true);
            try {
              await customerBackendApi.createProductInquiry(productSlug, {
                message: q.trim(),
                name: name.trim() || undefined,
                email: email.trim() || undefined
              });
              setSubmitOk(true);
              setQ("");
              await queryClient.invalidateQueries({ queryKey: ["customer-product-questions", productSlug] });
            } catch (err) {
              setSubmitErr(err instanceof CommerceApiError ? err.message : "Could not submit question.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <label className={labelClass} htmlFor="pq-name">
              Name (optional)
            </label>
            <input id="pq-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} type="text" />
          </div>
          <div>
            <label className={labelClass} htmlFor="pq-email">
              Email (optional)
            </label>
            <input id="pq-email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} type="email" />
          </div>
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
          {submitErr ? <p className="text-error text-sm">{submitErr}</p> : null}
          {submitOk ? <p className="text-secondary text-sm font-bold">Thanks — we received your question.</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full sm:w-auto bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold text-sm uppercase tracking-widest disabled:opacity-50"
          >
            {busy ? "Sending…" : "Submit question"}
          </button>
        </form>
        {questionsQuery.isPending ? (
          <p className="text-on-surface-variant">Loading Q&amp;A…</p>
        ) : (
          <div className="space-y-6">
            {qaItems.length === 0 ? (
              <p className="text-on-surface-variant text-sm">No answered questions yet — be the first to ask.</p>
            ) : (
              qaItems.map((item) => (
                <div key={item.id ?? item.question} className="border-b border-outline-variant/20 pb-6">
                  <p className="font-headline font-bold mb-2">{item.question}</p>
                  <p className="text-on-surface-variant text-sm mb-2">{item.answer}</p>
                  <p className="text-xs text-outline uppercase tracking-widest">Support</p>
                </div>
              ))
            )}
          </div>
        )}
      </StorefrontMain>
    </StorefrontShell>
  );
};

/* ── Saved items + recently viewed (catalog /saved-items) ── */
export const SavedItemsPage = () => {
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);
  const localWishlistIds = useCustomerStore((s) => s.wishlist);
  const recentSlugs = useCustomerStore((s) => s.recentlyViewedProductSlugs);
  const clearRecent = useCustomerStore((s) => s.clearRecentlyViewed);

  const remoteWishlistQuery = useQuery({
    queryKey: ["customer-wishlist"],
    queryFn: async () => {
      const { data } = await customerBackendApi.listWishlist();
      return data as { items?: unknown[] };
    },
    enabled: isAuthenticated,
    staleTime: 20_000
  });

  const guestWishlistQuery = useQuery({
    queryKey: ["customer-saved-wishlist-local", [...localWishlistIds].sort().join(",")],
    queryFn: async () => {
      const { data } = await customerBackendApi.listProducts({ page: 1, page_size: 100, sort: "newest" });
      const cards = mapStorefrontProductCards(data.items ?? []);
      const set = new Set(localWishlistIds);
      return cards.filter((p) => set.has(p.id));
    },
    enabled: !isAuthenticated && localWishlistIds.length > 0,
    staleTime: 30_000
  });

  const wishItems: Product[] = isAuthenticated
    ? (remoteWishlistQuery.data?.items ?? [])
        .map(mapWishlistApiItemToProduct)
        .filter((p): p is Product => Boolean(p))
    : guestWishlistQuery.data ?? [];

  const recentQueries = useQueries({
    queries: recentSlugs.slice(0, 12).map((slug) => ({
      queryKey: ["customer-product-detail", slug],
      queryFn: async () => {
        const { data } = await customerBackendApi.getProduct(slug);
        return mapPublicProductDetailToProduct(data);
      },
      enabled: Boolean(slug),
      staleTime: 120_000
    }))
  });

  const recentItems = recentQueries.map((r) => r.data).filter((p): p is Product => Boolean(p));

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
          {recentSlugs.length === 0 ? (
            <p className="text-on-surface-variant text-sm py-12 text-center bg-surface-container-low rounded-2xl">
              No recent items yet. Browse the{" "}
              <Link to="/shop" className="text-secondary font-bold underline underline-offset-4">
                shop
              </Link>
              .
            </p>
          ) : recentQueries.some((q) => q.isPending) ? (
            <p className="text-on-surface-variant text-sm py-8">Loading recent items…</p>
          ) : recentItems.length === 0 ? (
            <p className="text-on-surface-variant text-sm py-12 text-center bg-surface-container-low rounded-2xl">
              Recent products are no longer available.{" "}
              <Link to="/shop" className="text-secondary font-bold underline underline-offset-4">
                Browse shop
              </Link>
            </p>
          ) : (
            <div className="flex overflow-x-auto no-scrollbar gap-4 pb-2 snap-x">
              {recentItems.map((p) => (
                <div key={p.slug} className="flex-shrink-0 w-44 snap-start">
                  <ProductCard product={p} />
                </div>
              ))}
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
          {isAuthenticated && remoteWishlistQuery.isPending ? (
            <p className="text-on-surface-variant text-sm py-8">Loading wishlist…</p>
          ) : !isAuthenticated && localWishlistIds.length > 0 && guestWishlistQuery.isPending ? (
            <p className="text-on-surface-variant text-sm py-8">Loading wishlist…</p>
          ) : wishItems.length === 0 ? (
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
