import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { StorefrontMain, StorefrontShell, storefrontScrollRegionClasses } from "@/components/layout";
import { ProductCard, StarRating, TrustBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import {
  brandDirectory,
  brandDirectoryBySlug,
  brandSlugFromName,
  campaigns,
  featuredProducts,
  allProducts,
  productsBySlug,
  productsFromSlugs,
  campaignBySlug,
} from "@/lib/data/customer-mock";
import { customerApi } from "@/lib/api/customer";
import { formatGhs, FREE_SHIPPING_THRESHOLD_GHS } from "@/lib/currency";
import { mockImages } from "@/lib/data/mock-images";
import { neutralFieldClass } from "@/lib/form-field-styles";
import { searchCatalog } from "@/lib/catalog-search";
import { useCustomerStore } from "@/lib/store/customer-store";

const ShellMain = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <StorefrontShell>
    <StorefrontMain className={className}>{children}</StorefrontMain>
  </StorefrontShell>
);

/* ─────────────────────────────────────────────
   HOME PAGE — commerce hub (categories, brands, campaigns, offers)
───────────────────────────────────────────── */
export const HomePage = () => {
  const homepageQuery = useQuery({
    queryKey: ["customer-homepage"],
    queryFn: async () => (await customerApi.getHomepage()).entity
  });

  const promoCtaHref = (href: string, code: string) =>
    href.includes("promo=") ? href : `${href}${href.includes("?") ? "&" : "?"}promo=${encodeURIComponent(code)}`;

  if (homepageQuery.isPending) {
    return (
      <StorefrontShell>
        <main
          className={`${storefrontScrollRegionClasses} bg-surface text-on-background font-body overflow-x-hidden w-full max-w-full min-w-0`}
        >
          <section className="relative min-h-[min(72dvh,540px)] md:min-h-0 md:h-[min(92dvh,920px)] w-full overflow-hidden bg-neutral-950">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-container via-surface-container-high to-surface-container-low animate-pulse" />
            <div className="relative z-[1] min-h-[min(72dvh,540px)] md:min-h-0 md:h-full max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col justify-end md:justify-center items-stretch sm:items-start pb-16 md:pb-0 pt-24 md:pt-0 w-full min-w-0">
              <div className="h-3 w-40 rounded-full bg-white/20 mb-5" />
              <div className="h-14 sm:h-20 md:h-24 w-full max-w-3xl rounded-[2rem] bg-white/15 mb-5" />
              <div className="h-4 w-full max-w-xl rounded-full bg-white/15 mb-3" />
              <div className="h-4 w-[88%] max-w-lg rounded-full bg-white/15 mb-8" />
              <div className="h-12 w-40 rounded-full bg-white/20" />
            </div>
          </section>

          <section className="border-y border-outline-variant/15 bg-surface-container-lowest/80">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-8">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-start gap-4 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high shrink-0" />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="h-4 w-28 rounded-full bg-surface-container-high" />
                    <div className="h-3 w-40 rounded-full bg-surface-container-high mt-2" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </StorefrontShell>
    );
  }

  if (homepageQuery.isError) {
    return (
      <StorefrontShell>
        <main
          className={`${storefrontScrollRegionClasses} bg-surface text-on-background font-body overflow-x-hidden w-full max-w-full min-w-0`}
        >
          <section className="max-w-screen-md mx-auto px-4 sm:px-6 md:px-8 py-24 sm:py-28 md:py-32">
            <div className="rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest p-8 sm:p-10 shadow-sm text-center">
              <p className="font-label text-[10px] sm:text-xs uppercase tracking-[0.22em] text-secondary font-bold mb-3">
                Homepage unavailable
              </p>
              <h1 className="font-headline text-2xl sm:text-4xl font-extrabold tracking-tight text-on-background mb-3">
                The published homepage could not be loaded.
              </h1>
              <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
                Check the homepage publish state in admin or retry once the backend content endpoint is available.
              </p>
              <button
                type="button"
                onClick={() => void homepageQuery.refetch()}
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3 text-xs font-label font-bold uppercase tracking-[0.18em] text-on-secondary hover:brightness-110 transition-[filter]"
              >
                Retry
                <Icon name="refresh" className="text-base" />
              </button>
            </div>
          </section>
        </main>
      </StorefrontShell>
    );
  }

  const homepage = homepageQuery.data;

  return (
    <StorefrontShell>
      <main
        className={`${storefrontScrollRegionClasses} bg-surface text-on-background font-body overflow-x-hidden w-full max-w-full min-w-0`}
      >
        <section className="relative min-h-[min(72dvh,540px)] md:min-h-0 md:h-[min(92dvh,920px)] w-full overflow-hidden bg-neutral-950">
          <img
            className="absolute inset-0 w-full h-full object-cover object-center opacity-95 md:opacity-92"
            src={homepage.hero.backgroundImageUrl}
            alt={homepage.hero.backgroundImageAlt}
          />
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/72 md:from-black/58 via-black/28 md:via-black/15 to-transparent" />
          <div className="relative z-[1] min-h-[min(72dvh,540px)] md:min-h-0 md:h-full max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col justify-end md:justify-center items-stretch sm:items-start pb-16 md:pb-0 pt-24 md:pt-0 w-full min-w-0">
            {homepage.hero.eyebrow ? (
              <span className="font-label text-tertiary-fixed tracking-[0.2em] sm:tracking-[0.28em] uppercase text-[10px] sm:text-xs mb-3 md:mb-5 font-bold">
                {homepage.hero.eyebrow}
              </span>
            ) : null}
            <h1 className="font-headline text-3xl leading-[1.08] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold text-white tracking-tighter max-w-full sm:max-w-3xl md:leading-[0.92] mb-4 md:mb-7 break-words text-balance">
              {homepage.hero.titlePrefix}
              {homepage.hero.titleAccent ? (
                <>
                  {" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-emerald-200 to-amber-200">
                    {homepage.hero.titleAccent}
                  </span>
                </>
              ) : null}
              {homepage.hero.titleSuffix ?? null}
            </h1>
            <p className="text-primary-fixed text-sm sm:text-base md:text-lg max-w-full sm:max-w-md md:max-w-lg mb-6 md:mb-10 font-light leading-relaxed">
              {homepage.hero.body}
            </p>
            <div className="hero-cta-glow w-fit max-w-full self-start">
              <Link
                to={homepage.hero.primaryCtaHref}
                className="bg-secondary text-on-secondary px-5 sm:px-7 py-2.5 sm:py-3 rounded-full text-sm sm:text-[0.9375rem] font-semibold hover:brightness-110 active:scale-[0.98] transition-[transform,filter] duration-200 inline-flex items-center justify-center gap-1.5 sm:gap-2 group shadow-md shadow-secondary/25"
                aria-label={homepage.hero.primaryCtaLabel}
              >
                {homepage.hero.primaryCtaLabel}
                <Icon name="arrow_forward" className="text-base sm:text-lg group-hover:translate-x-0.5 transition-transform duration-200" />
              </Link>
            </div>
          </div>
        </section>

        {homepage.trustBadges.length > 0 ? (
          <section className="border-y border-outline-variant/15 bg-surface-container-lowest/80">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-8">
              {homepage.trustBadges.map((badge) => (
                <TrustBadge
                  key={`${badge.iconName}-${badge.title}`}
                  icon={badge.iconName}
                  title={badge.title}
                  sub={badge.subtitle}
                  to={badge.href ?? undefined}
                  ariaLabel={badge.ariaLabel ?? undefined}
                />
              ))}
            </div>
          </section>
        ) : null}

        {homepage.categorySection.isVisible && homepage.categorySection.items.length > 0 ? (
          <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 w-full min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-12 min-w-0">
              <div className="max-w-2xl min-w-0">
                {homepage.categorySection.eyebrow ? (
                  <p className="font-label text-[10px] sm:text-xs uppercase tracking-[0.22em] text-secondary font-bold mb-2">
                    {homepage.categorySection.eyebrow}
                  </p>
                ) : null}
                <h2 className="font-headline text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-on-background break-words text-balance">
                  {homepage.categorySection.title}
                </h2>
                <p className="text-on-surface-variant text-sm sm:text-base mt-2 leading-relaxed">
                  {homepage.categorySection.description}
                </p>
              </div>
              {homepage.categorySection.ctaLabel && homepage.categorySection.ctaHref ? (
                <Link
                  to={homepage.categorySection.ctaHref}
                  className="inline-flex items-center gap-2 shrink-0 text-secondary font-label font-bold text-xs uppercase tracking-[0.18em] hover:underline underline-offset-4 py-1"
                  aria-label={homepage.categorySection.ctaLabel}
                >
                  {homepage.categorySection.ctaLabel}
                  <Icon name="arrow_forward" className="text-base" />
                </Link>
              ) : null}
            </div>
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-4 w-full min-w-0">
              {homepage.categorySection.items.map((category) => (
                <Link
                  key={category.slug}
                  to={category.href}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-outline-variant/18 bg-surface-container-lowest shadow-sm hover:border-secondary/30 hover:shadow-[0_16px_40px_rgba(11,28,48,0.08)] transition-all min-w-0 max-w-full"
                  aria-label={`Shop ${category.title}: ${category.description}. ${category.productCount} product${category.productCount === 1 ? "" : "s"} in this category.`}
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-surface-container-low w-full">
                    <img
                      src={category.imageUrl}
                      alt={`${category.title} — ${category.description}`}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary-container/75 via-primary-container/10 to-transparent" />
                  </div>
                  <div className="p-3 sm:p-4 flex flex-col flex-1">
                    <h3 className="font-headline font-bold text-sm sm:text-base text-on-background group-hover:text-secondary transition-colors">
                      {category.title}
                    </h3>
                    <p className="text-on-surface-variant text-[11px] sm:text-xs mt-1 leading-snug line-clamp-2">
                      {category.description}
                    </p>
                    <span className="mt-3 font-label text-[10px] uppercase tracking-widest text-outline font-bold">
                      {category.productCount} piece{category.productCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {homepage.featuredSection.isVisible && homepage.featuredSection.items.length > 0 ? (
          <section className="bg-surface-container-low/50 border-y border-outline-variant/10 w-full min-w-0">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 w-full min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-12 min-w-0">
                <div className="min-w-0">
                  {homepage.featuredSection.eyebrow ? (
                    <p className="font-label text-[10px] sm:text-xs uppercase tracking-[0.22em] text-secondary font-bold mb-2">
                      {homepage.featuredSection.eyebrow}
                    </p>
                  ) : null}
                  <h2 className="font-headline text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight break-words">
                    {homepage.featuredSection.title}
                  </h2>
                  <p className="text-on-surface-variant text-sm sm:text-base mt-2 max-w-xl">
                    {homepage.featuredSection.description}
                  </p>
                </div>
                {homepage.featuredSection.ctaLabel && homepage.featuredSection.ctaHref ? (
                  <Link
                    to={homepage.featuredSection.ctaHref}
                    className="inline-flex items-center gap-2 text-secondary font-label font-bold text-xs uppercase tracking-[0.18em] hover:underline underline-offset-4 shrink-0 py-1"
                    aria-label={homepage.featuredSection.ctaLabel}
                  >
                    {homepage.featuredSection.ctaLabel}
                    <Icon name="arrow_forward" className="text-base" />
                  </Link>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12 lg:gap-x-8 lg:gap-y-14 w-full min-w-0 [&>*]:min-w-0">
                {homepage.featuredSection.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {homepage.brandSection.isVisible && homepage.brandSection.items.length > 0 ? (
          <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 w-full min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-12 min-w-0">
              <div className="max-w-2xl min-w-0">
                {homepage.brandSection.eyebrow ? (
                  <p className="font-label text-[10px] sm:text-xs uppercase tracking-[0.22em] text-secondary font-bold mb-2">
                    {homepage.brandSection.eyebrow}
                  </p>
                ) : null}
                <h2 className="font-headline text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight break-words">
                  {homepage.brandSection.title}
                </h2>
                <p className="text-on-surface-variant text-sm sm:text-base mt-2 leading-relaxed">
                  {homepage.brandSection.description}
                </p>
              </div>
              {homepage.brandSection.ctaLabel && homepage.brandSection.ctaHref ? (
                <Link
                  to={homepage.brandSection.ctaHref}
                  className="inline-flex items-center gap-2 text-secondary font-label font-bold text-xs uppercase tracking-[0.18em] hover:underline underline-offset-4 shrink-0 py-1"
                  aria-label={homepage.brandSection.ctaLabel}
                >
                  {homepage.brandSection.ctaLabel}
                  <Icon name="arrow_forward" className="text-base" />
                </Link>
              ) : null}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 w-full min-w-0">
              {homepage.brandSection.items.map((brand) => (
                <div
                  key={brand.slug}
                  className="rounded-2xl border border-outline-variant/18 bg-surface-container-lowest overflow-hidden shadow-sm flex flex-col min-w-0 max-w-full"
                >
                  <Link
                    to={brand.href}
                    className="group relative block aspect-[16/9] overflow-hidden bg-surface-container-low shrink-0"
                    aria-label={`${brand.title} brand — ${brand.tagline}. View full collection.`}
                  >
                    <img
                      src={brand.heroImageUrl}
                      alt={`${brand.title}: ${brand.tagline}`}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary-container/80 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-2">
                      <div>
                        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-white/85 font-bold">
                          House
                        </p>
                        <h3 className="font-headline text-xl sm:text-2xl font-extrabold text-white">
                          {brand.title}
                        </h3>
                      </div>
                      <Icon
                        name="arrow_forward"
                        className="text-white text-2xl shrink-0 opacity-90 group-hover:translate-x-0.5 transition-transform"
                      />
                    </div>
                  </Link>
                  <div className="p-4 sm:p-5 flex flex-col flex-1">
                    <p className="text-on-surface-variant text-sm leading-relaxed line-clamp-2">{brand.tagline}</p>
                    {brand.products.length > 0 ? (
                      <>
                        <p className="font-label text-[10px] uppercase tracking-widest text-outline font-bold mt-4 mb-2">
                          Shop directly
                        </p>
                        <div className="grid grid-cols-3 gap-2 w-full min-w-0">
                          {brand.products.map((product) => (
                            <Link
                              key={product.id}
                              to={`/products/${product.slug}`}
                              className="group/p flex min-w-0 flex-col gap-1.5"
                              aria-label={`${product.name} by ${brand.title} — ${product.category}, ${formatGhs(product.price)}. View product.`}
                            >
                              <div className="aspect-[3/4] rounded-lg overflow-hidden border border-outline-variant/15 bg-surface-container-low w-full">
                                <img
                                  src={product.imageUrl}
                                  alt={`${product.name} — ${brand.title}`}
                                  className="h-full w-full object-cover group-hover/p:scale-105 transition-transform duration-500"
                                />
                              </div>
                              <span className="text-[10px] font-headline font-semibold text-on-background line-clamp-2 leading-tight group-hover/p:text-secondary transition-colors break-words">
                                {product.name}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </>
                    ) : null}
                    <Link
                      to={brand.href}
                      className="mt-4 inline-flex items-center gap-1 text-secondary font-label font-bold text-[10px] uppercase tracking-widest hover:underline underline-offset-4"
                      aria-label={brand.ctaLabel}
                    >
                      {brand.ctaLabel}
                      <Icon name="chevron_right" className="text-sm" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {homepage.campaignSection.isVisible && homepage.campaignSection.items.length > 0 ? (
          <section className="bg-surface-container-low/40 border-t border-outline-variant/10 w-full min-w-0">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 w-full min-w-0">
              <div className="mb-10 md:mb-14 max-w-2xl min-w-0">
                {homepage.campaignSection.eyebrow ? (
                  <p className="font-label text-[10px] sm:text-xs uppercase tracking-[0.22em] text-secondary font-bold mb-2">
                    {homepage.campaignSection.eyebrow}
                  </p>
                ) : null}
                <h2 className="font-headline text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight break-words">
                  {homepage.campaignSection.title}
                </h2>
                <p className="text-on-surface-variant text-sm sm:text-base mt-2">
                  {homepage.campaignSection.description}
                </p>
                {homepage.campaignSection.ctaLabel && homepage.campaignSection.ctaHref ? (
                  <Link
                    to={homepage.campaignSection.ctaHref}
                    className="inline-flex items-center gap-2 mt-4 text-secondary font-label font-bold text-xs uppercase tracking-widest hover:underline underline-offset-4"
                    aria-label={homepage.campaignSection.ctaLabel}
                  >
                    {homepage.campaignSection.ctaLabel}
                    <Icon name="arrow_forward" className="text-base" />
                  </Link>
                ) : null}
              </div>
              <div className="flex flex-col gap-12 md:gap-16 min-w-0">
                {homepage.campaignSection.items.map((campaign) => (
                  <div key={campaign.slug} className="min-w-0">
                    {campaign.layout === "FEATURE" ? (
                      <Link
                        to={campaign.href}
                        className="group relative block overflow-hidden rounded-2xl border border-outline-variant/15 bg-primary-container min-h-[240px] sm:min-h-[300px] md:min-h-[380px] md:h-[380px] w-full max-w-full"
                        aria-label={`${campaign.title}: ${campaign.subtitle}. ${campaign.ctaLabel}.`}
                      >
                        <img
                          src={campaign.heroImageUrl}
                          alt={`${campaign.title} campaign`}
                          className="absolute inset-0 h-full w-full object-cover object-center opacity-55 transition-transform duration-[2.2s] group-hover:scale-[1.04]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-primary-container/95 via-primary-container/55 to-transparent" />
                        <div className="relative z-[1] h-full min-h-[240px] sm:min-h-[300px] md:min-h-[380px] md:h-[380px] flex flex-col justify-end md:justify-center p-5 sm:p-10 md:p-14 w-full max-w-full md:max-w-lg min-w-0">
                          <span className="font-label text-tertiary-fixed tracking-[0.3em] uppercase text-[10px] font-bold mb-2">
                            {campaign.label}
                          </span>
                          <h3 className="text-white font-headline text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tighter mb-3 break-words">
                            {campaign.title}
                          </h3>
                          <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-5 break-words">
                            {campaign.subtitle}
                          </p>
                          <span className="inline-flex items-center gap-2 bg-white text-on-background px-5 py-2.5 rounded-xl font-label font-bold text-xs uppercase tracking-widest group-hover:bg-secondary group-hover:text-on-secondary transition-colors w-fit">
                            {campaign.ctaLabel}
                            <Icon name="arrow_forward" className="text-base" />
                          </span>
                        </div>
                      </Link>
                    ) : (
                      <Link
                        to={campaign.href}
                        className="group relative flex flex-col md:flex-row overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest min-h-[200px] w-full max-w-full"
                        aria-label={`${campaign.title}: ${campaign.subtitle}. ${campaign.ctaLabel}.`}
                      >
                        <div className="relative w-full md:w-1/2 min-h-[180px] sm:min-h-[220px] md:min-h-[280px] shrink-0">
                          <img
                            src={campaign.heroImageUrl}
                            alt={`${campaign.title} campaign`}
                            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.03]"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-primary-container/50 to-transparent" />
                        </div>
                        <div className="flex flex-1 flex-col justify-center p-5 sm:p-8 md:p-10 min-w-0">
                          <span className="font-label text-secondary tracking-[0.22em] uppercase text-[10px] font-bold mb-2">
                            {campaign.label}
                          </span>
                          <h3 className="font-headline text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight mb-2 break-words">
                            {campaign.title}
                          </h3>
                          <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed mb-5 break-words">
                            {campaign.subtitle}
                          </p>
                          <span className="inline-flex items-center gap-2 text-secondary font-label font-bold text-xs uppercase tracking-widest group-hover:underline underline-offset-4 w-fit">
                            {campaign.ctaLabel}
                            <Icon name="arrow_forward" className="text-base" />
                          </span>
                        </div>
                      </Link>
                    )}
                    {campaign.products.length > 0 ? (
                      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 w-full min-w-0 [&>*]:min-w-0">
                        {campaign.products.map((product) => (
                          <ProductCard key={product.id} product={product} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {homepage.promoSection.isVisible && homepage.promoSection.items.length > 0 ? (
          <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 w-full min-w-0">
            <div className="mb-8 md:mb-12 max-w-2xl min-w-0">
              {homepage.promoSection.eyebrow ? (
                <p className="font-label text-[10px] sm:text-xs uppercase tracking-[0.22em] text-secondary font-bold mb-2">
                  {homepage.promoSection.eyebrow}
                </p>
              ) : null}
              <h2 className="font-headline text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight break-words">
                {homepage.promoSection.title}
              </h2>
              <p className="text-on-surface-variant text-sm sm:text-base mt-2">
                {homepage.promoSection.description}
              </p>
            </div>
            <div className="flex flex-col gap-10 md:gap-14 min-w-0">
              {homepage.promoSection.items.map((promo, index) => (
                <div
                  key={`${promo.code}-${index}`}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8 rounded-2xl border border-outline-variant/15 overflow-hidden bg-surface-container-lowest shadow-sm w-full min-w-0 max-w-full"
                >
                  <div className={`relative lg:col-span-5 min-h-[200px] sm:min-h-[240px] ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                    <img
                      src={promo.bannerImageUrl}
                      alt={`${promo.headline} — promotional banner, code ${promo.code}`}
                      className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-primary-container/88 via-primary-container/35 to-transparent" />
                    <div className="relative h-full min-h-[220px] sm:min-h-[260px] flex flex-col justify-end p-6 sm:p-8">
                      <span className="inline-flex w-fit rounded-full bg-white/15 backdrop-blur-md px-3 py-1 font-label text-[10px] uppercase tracking-widest text-white font-bold border border-white/20">
                        {promo.badge}
                      </span>
                      <p className="mt-4 font-mono text-white text-2xl sm:text-3xl font-bold tracking-widest">
                        {promo.code}
                      </p>
                    </div>
                  </div>
                  <div className={`lg:col-span-7 p-5 sm:p-8 md:p-10 flex flex-col min-w-0 ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                    <h3 className="font-headline text-lg sm:text-2xl font-extrabold tracking-tight text-on-background break-words">
                      {promo.headline}
                    </h3>
                    <p className="text-on-surface-variant text-sm sm:text-base mt-3 leading-relaxed break-words">
                      {promo.body}
                    </p>
                    <p className="text-outline text-xs mt-4 leading-relaxed border-l-2 border-secondary/40 pl-3 break-words">
                      {promo.terms}
                    </p>
                    <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
                      <Link
                        to={promoCtaHref(promo.ctaHref, promo.code)}
                        className="inline-flex w-full sm:w-fit justify-center items-center gap-2 bg-secondary text-on-secondary px-6 py-3 rounded-xl font-label font-bold text-xs uppercase tracking-widest hover:opacity-95 transition-opacity"
                        aria-label={`${promo.ctaLabel} — use offer code ${promo.code} at checkout`}
                      >
                        {promo.ctaLabel}
                        <Icon name="arrow_forward" className="text-base" />
                      </Link>
                      <Link
                        to="/cart"
                        className="inline-flex w-full sm:w-fit justify-center items-center gap-2 border-2 border-outline-variant/30 text-on-background px-6 py-3 rounded-xl font-label font-bold text-xs uppercase tracking-widest hover:border-secondary/40 transition-colors"
                        aria-label={`Go to bag to apply code ${promo.code}`}
                      >
                        View bag
                      </Link>
                    </div>
                    {promo.products.length > 0 ? (
                      <>
                        <p className="font-label text-[10px] uppercase tracking-widest text-outline font-bold mt-8 mb-3">
                          Featured with this offer
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5 w-full min-w-0 [&>*]:min-w-0">
                          {promo.products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {homepage.testimonialSection.isVisible && homepage.testimonialSection.items.length > 0 ? (
          <section className="bg-surface-container-low py-12 sm:py-16 md:py-24 border-t border-outline-variant/10 w-full min-w-0">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 w-full min-w-0">
              <div className="text-center mb-10 md:mb-14 px-1">
                {homepage.testimonialSection.eyebrow ? (
                  <p className="font-label text-[10px] sm:text-xs uppercase tracking-[0.22em] text-secondary font-bold mb-2">
                    {homepage.testimonialSection.eyebrow}
                  </p>
                ) : null}
                <h2 className="font-headline text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
                  {homepage.testimonialSection.title}
                </h2>
                <p className="text-on-surface-variant max-w-xl mx-auto text-sm sm:text-base">
                  {homepage.testimonialSection.description}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {homepage.testimonialSection.items.map((testimonial, index) => (
                  <div
                    key={`${testimonial.customerName}-${index}`}
                    className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-outline-variant/12 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-1 mb-4 text-tertiary">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Icon key={starIndex} name="star" filled className="text-tertiary text-lg" />
                      ))}
                    </div>
                    <p className="text-on-surface mb-6 italic leading-relaxed text-sm sm:text-base">
                      {testimonial.quote}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-surface-container-high ring-2 ring-white shadow-sm">
                        <img
                          className="w-full h-full object-cover"
                          src={testimonial.imageUrl}
                          alt={`Portrait of ${testimonial.customerName}`}
                        />
                      </div>
                      <div>
                        <p className="font-headline font-bold text-sm">{testimonial.customerName}</p>
                        <p className="text-outline text-xs font-medium">
                          {testimonial.statusLabel ?? "Verified purchase"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </StorefrontShell>
  );
};

/* ─────────────────────────────────────────────
   SHOP ALL PAGE
───────────────────────────────────────────── */
export const ShopAllPage = () => {
  const [sort, setSort] = useState("featured");

  return (
    <ShellMain>
        <header className="mb-10 md:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline font-extrabold tracking-tighter text-on-background mb-4">Shop All</h1>
          <p className="text-on-surface-variant max-w-xl">
            A complete catalogue of curated pieces across all categories.
          </p>
        </header>
        {/* Filter Bar */}
        <div className="bg-white border border-outline-variant/20 p-6 rounded-xl mb-12 flex flex-col md:flex-row gap-6 items-end shadow-sm">
          <div className="w-full md:w-1/3">
            <label className="block text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">
              Category
            </label>
            <select className={`w-full rounded-lg py-3 px-4 text-sm outline-none ${neutralFieldClass}`}>
              <option>All Categories</option>
              <option>Outerwear</option>
              <option>Basics</option>
              <option>Footwear</option>
              <option>Eyewear</option>
              <option>Knitwear</option>
            </select>
          </div>
          <div className="w-full md:w-1/4">
            <label className="block text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">
              Sort By
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={`w-full rounded-lg py-3 px-4 text-sm outline-none ${neutralFieldClass}`}
            >
              <option value="featured">Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
          <div className="w-full md:w-1/4">
            <label className="block text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">
              Price Range
            </label>
            <select className={`w-full rounded-lg py-3 px-4 text-sm outline-none ${neutralFieldClass}`}>
              <option>All Prices</option>
              <option>{`Under ${formatGhs(100, 0)}`}</option>
              <option>{`${formatGhs(100, 0)} – ${formatGhs(500, 0)}`}</option>
              <option>{`${formatGhs(500, 0)}+`}</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
          {allProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
    </ShellMain>
  );
};

/* ─────────────────────────────────────────────
   CATEGORY PAGE
───────────────────────────────────────────── */
export const CategoryPage = () => {
  const { categorySlug } = useParams();
  const category = categorySlug ?? "all";
  const label = category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, " ");
  const filtered = allProducts.filter((p) =>
    category === "all" ? true : p.category.toLowerCase().includes(category.toLowerCase())
  );

  return (
    <ShellMain>
        <nav className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs font-label tracking-widest uppercase text-outline mb-6 md:mb-10">
          <Link className="hover:text-secondary transition-colors" to="/">Home</Link>
          <Icon name="chevron_right" className="text-[10px]" />
          <span className="text-on-surface">{label}</span>
        </nav>
        <header className="mb-10 md:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline font-extrabold tracking-tighter text-on-background mb-4">{label}</h1>
          <p className="text-on-surface-variant">{filtered.length} items</p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
          {(filtered.length > 0 ? filtered : allProducts).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
    </ShellMain>
  );
};

/* ─────────────────────────────────────────────
   PRODUCT DETAIL PAGE — matches product_detail_page/code.html
───────────────────────────────────────────── */
export const ProductDetailPage = () => {
  const { productSlug } = useParams();
  const product = productSlug ? productsBySlug[productSlug] : undefined;
  const addToCart = useCustomerStore((s) => s.addToCart);
  const wishlist = useCustomerStore((s) => s.wishlist);
  const toggleWishlist = useCustomerStore((s) => s.toggleWishlist);
  const addRecentlyViewed = useCustomerStore((s) => s.addRecentlyViewed);
  const inWishlist = product ? wishlist.includes(product.id) : false;
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(0);
  const [activeTab, setActiveTab] = useState<"description" | "specs" | "shipping">("description");

  useEffect(() => {
    if (productSlug && productsBySlug[productSlug]) addRecentlyViewed(productSlug);
  }, [productSlug, addRecentlyViewed]);

  if (!product) {
    return (
      <ShellMain>
        <div className="py-20 text-center">
          <p className="text-on-surface-variant">Product not found.</p>
          <Link to="/shop" className="mt-6 inline-block text-secondary underline">
            Back to Shop
          </Link>
        </div>
      </ShellMain>
    );
  }

  return (
    <ShellMain className="text-on-surface antialiased min-w-0 overflow-x-hidden">
        {/* Breadcrumbs */}
        <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-xs font-label tracking-widest uppercase text-outline mb-6 md:mb-10">
          <Link className="hover:text-secondary transition-colors shrink-0" to="/">Home</Link>
          <Icon name="chevron_right" className="text-[10px] shrink-0" />
          <Link className="hover:text-secondary transition-colors break-words" to={`/categories/${product.category.toLowerCase()}`}>{product.category}</Link>
          <Icon name="chevron_right" className="text-[10px] shrink-0" />
          <span className="text-on-surface min-w-0 max-w-full break-words">{product.name}</span>
        </nav>

        <div className="grid grid-cols-12 gap-6 md:gap-8 lg:gap-16">
          {/* Gallery — mobile: hero + horizontal thumbs; desktop: thumbs left */}
          <div className="col-span-12 lg:col-span-7 min-w-0">
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-w-0">
              <div className="order-2 lg:order-none flex flex-row lg:flex-col gap-3 lg:gap-4 lg:w-20 shrink-0 overflow-x-auto no-scrollbar pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0 w-full lg:w-auto">
                <button type="button" className="flex-shrink-0 w-16 sm:w-20 aspect-[3/4] bg-surface-container-low overflow-hidden rounded-sm group border-2 border-secondary">
                  <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={product.imageUrl} alt={product.name} />
                </button>
                {(product.images ?? []).slice(1, 3).map((img, i) => (
                  <button key={i} type="button" className="flex-shrink-0 w-16 sm:w-20 aspect-[3/4] bg-surface-container-low overflow-hidden rounded-sm group border-2 border-transparent">
                    <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={img} alt="" />
                  </button>
                ))}
                <Link
                  to={`/products/${product.slug}/media`}
                  className="flex-shrink-0 w-16 sm:w-20 aspect-[3/4] bg-surface-container-low flex flex-col items-center justify-center text-outline hover:bg-surface-container-high transition-colors"
                >
                  <Icon name="360" className="text-xl sm:text-2xl" />
                  <span className="text-[10px] font-label font-bold uppercase mt-1">Gallery</span>
                </Link>
              </div>
              <div className="order-1 lg:order-none w-full min-w-0 flex-1 relative aspect-[3/4] sm:aspect-[4/5] lg:aspect-[4/5] max-h-[min(78dvh,560px)] sm:max-h-[min(88dvh,640px)] lg:max-h-none bg-surface-container-low overflow-hidden rounded-sm group">
                <img className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700 cursor-zoom-in" src={product.imageUrl} alt={product.name} />
                {product.badge && (
                  <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
                    <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-3 py-1 text-[10px] font-label font-bold uppercase tracking-widest shadow-sm">
                      {product.badge}
                    </span>
                  </div>
                )}
                <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col gap-2">
                  <Link
                    to={`/products/${product.slug}/media`}
                    className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-on-surface shadow-lg hover:bg-white transition-all active:scale-95"
                    aria-label="Open gallery"
                  >
                    <Icon name="fullscreen" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="col-span-12 lg:col-span-5 min-w-0">
            <div className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <StarRating rating={product.rating ?? 4} />
                <Link
                  to={`/products/${product.slug}/reviews`}
                  className="text-xs font-label text-outline hover:text-secondary underline underline-offset-4"
                >
                  {product.reviewCount ?? 0} reviews
                </Link>
                <span className="text-outline hidden sm:inline">·</span>
                <Link
                  to={`/products/${product.slug}/questions`}
                  className="text-xs font-label text-secondary font-bold uppercase tracking-widest hover:underline"
                >
                  Q&amp;A
                </Link>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-extrabold tracking-tighter text-on-surface mb-2 break-words">{product.name}</h1>
              <p className="text-outline font-body mb-6 sm:mb-8 leading-relaxed max-w-full sm:max-w-md text-sm sm:text-base">{product.description}</p>

              {/* Price */}
              <div className="mb-8 sm:mb-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
                <div className="flex flex-wrap items-end gap-3 sm:gap-4">
                  <div className="flex flex-col min-w-0">
                    {product.originalPrice && (
                      <span className="text-xs font-label text-outline line-through">{formatGhs(product.originalPrice)}</span>
                    )}
                    <span className="text-2xl sm:text-3xl font-headline font-bold text-on-surface tabular-nums">{formatGhs(product.price)}</span>
                  </div>
                  {product.originalPrice && (
                    <div className="bg-secondary-container text-white px-3 py-1 rounded-sm text-xs font-label font-bold flex items-center gap-1 self-end mb-0.5">
                      {`Save ${formatGhs(product.originalPrice - product.price, 0)}`}
                    </div>
                  )}
                </div>
                <div className="sm:ml-auto sm:text-right pt-1 sm:pt-0 border-t border-outline-variant/15 sm:border-0">
                  <span className="text-[10px] font-label font-bold text-error uppercase tracking-widest inline-flex items-center gap-1 sm:justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse shrink-0" />
                    Only 2 Left
                  </span>
                </div>
              </div>

              {/* Color Variants */}
              {product.colorVariants && product.colorVariants.length > 0 && (
                <div className="mb-8">
                  <div className="flex justify-between items-end mb-4">
                    <span className="text-xs font-label font-bold uppercase tracking-widest">
                      Color: <span className="text-outline font-normal">{product.colorVariants[selectedColor].name}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {product.colorVariants.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedColor(i)}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          i === selectedColor
                            ? "border-on-surface ring-2 ring-offset-2 ring-on-surface"
                            : "border-transparent hover:border-outline-variant"
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Sizes */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="mb-10">
                  <div className="flex justify-between items-end mb-4">
                    <span className="text-xs font-label font-bold uppercase tracking-widest">Size</span>
                    <button className="text-[10px] font-label text-secondary underline underline-offset-2 uppercase tracking-widest font-bold">
                      Size Guide
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 gap-2 sm:gap-3">
                    {product.sizes.map((size) => {
                      const oos = product.outOfStockSizes?.includes(size);
                      return (
                        <button
                          key={size}
                          onClick={() => !oos && setSelectedSize(size)}
                          className={`py-3 text-sm font-label border transition-colors ${
                            oos
                              ? "border-outline-variant opacity-40 cursor-not-allowed line-through"
                              : selectedSize === size
                              ? "border-on-surface bg-on-surface text-white"
                              : "border-outline-variant hover:border-on-surface"
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="flex flex-row gap-3 sm:gap-4 mb-10 items-stretch">
                <button
                  type="button"
                  onClick={() =>
                    addToCart({
                      productId: product.id,
                      variantId: `${product.id}-${selectedSize ?? "default"}`,
                      quantity: 1,
                      price: product.price,
                      name: product.name,
                      imageUrl: product.imageUrl,
                    })
                  }
                  className="flex-1 min-w-0 min-h-[3.5rem] sm:min-h-[3.75rem] bg-primary text-on-primary py-3 sm:py-4 rounded-sm font-label font-bold uppercase tracking-widest hover:bg-secondary transition-all active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base px-2 sm:px-4"
                >
                  <Icon name="shopping_bag" className="shrink-0" />
                  <span className="text-center leading-tight">Add to Bag</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  className="shrink-0 w-14 min-h-[3.5rem] sm:w-16 sm:min-h-[3.75rem] border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors group"
                >
                  <Icon name="favorite" filled={inWishlist} className={`group-hover:text-error transition-colors ${inWishlist ? "text-error" : ""}`} />
                </button>
              </div>

              {/* Trust Cues */}
              <div className="bg-surface-container-low p-4 sm:p-6 rounded-sm space-y-4">
                <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                  <Icon name="local_shipping" className="text-secondary shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-xs font-label font-bold uppercase tracking-wider mb-1">Complimentary Shipping</h4>
                    <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed">
                      Standard and express options at checkout. Most orders ship within 3-5 business days.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                  <Icon name="verified_user" className="text-secondary shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-xs font-label font-bold uppercase tracking-wider mb-1">Authenticity Guaranteed</h4>
                    <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed">
                      Each piece includes a digital certificate of authenticity and unique serial number.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-16 md:mt-32 border-t border-outline-variant/20 pt-10 md:pt-16">
          <div className="flex gap-4 sm:gap-8 md:gap-16 mb-8 md:mb-12 border-b border-outline-variant/10 overflow-x-auto no-scrollbar">
            {(["description", "specs", "shipping"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 md:pb-6 text-xs sm:text-sm font-label uppercase tracking-widest whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab
                    ? "font-bold border-b-2 border-on-surface"
                    : "font-medium text-outline hover:text-on-surface transition-colors"
                }`}
              >
                {tab === "description" ? "Description" : tab === "specs" ? "Specifications" : "Shipping & Returns"}
              </button>
            ))}
          </div>
          {activeTab === "description" && (
            <div className="grid grid-cols-12 gap-8 lg:gap-16">
              <div className="col-span-12 lg:col-span-6 min-w-0">
                <h3 className="text-xl sm:text-2xl font-headline font-bold mb-4 sm:mb-6">The Narrative</h3>
                <div className="space-y-4 text-on-surface-variant leading-relaxed sm:leading-loose font-light text-sm sm:text-base">
                  <p className="break-words">{product.description}</p>
                  <p>
                    Cut from premium cotton with a soft hand-feel and durable construction — the kind of tee you will reach for weekly. Pair it with denim, joggers, or layer under a jacket.
                  </p>
                </div>
              </div>
              <div className="col-span-12 lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 min-w-0">
                <div className="aspect-[4/3] sm:aspect-square max-h-80 sm:max-h-none w-full bg-surface-container overflow-hidden rounded-sm">
                  <img className="w-full h-full object-cover" src={product.imageUrl} alt="detail" />
                </div>
                <div className="flex flex-col justify-center min-w-0 pt-2 sm:pt-0">
                  <h4 className="text-xs font-label font-bold uppercase tracking-widest mb-4">Craftsmanship Details</h4>
                  <ul className="space-y-3 text-sm text-on-surface-variant">
                    {["Premium cotton jersey", "Reinforced collar & seams", "Pre-shrunk for consistent fit", "Machine wash cold; tumble low"].map((d) => (
                      <li key={d} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-secondary rounded-full" /> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          {activeTab === "specs" && (
            <div className="max-w-2xl w-full min-w-0 -mx-1 px-1 sm:mx-0 sm:px-0 overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[min(100%,20rem)]">
                <tbody className="divide-y divide-outline-variant/20">
                  {[["Material", "100% Italian Virgin Wool"], ["Care", "Dry clean only"], ["Fit", "Regular fit"], ["Origin", "Made in Italy"]].map(([k, v]) => (
                    <tr key={k}>
                      <td className="py-3 sm:py-4 pr-3 font-label font-bold uppercase text-[10px] tracking-widest text-on-surface-variant w-[36%] sm:w-1/3 align-top break-words">{k}</td>
                      <td className="py-3 sm:py-4 text-on-surface align-top break-words">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {activeTab === "shipping" && (
            <div className="max-w-2xl space-y-8 text-sm text-on-surface-variant leading-relaxed">
              <div>
                <h4 className="font-label font-bold uppercase text-xs tracking-widest text-on-surface mb-2">Delivery</h4>
                <p>Standard delivery: 3-5 business days. Express: next business day for orders placed before noon.</p>
              </div>
              <div>
                <h4 className="font-label font-bold uppercase text-xs tracking-widest text-on-surface mb-2">Returns</h4>
                <p>Returns are accepted within 30 days of delivery. Items must be unworn and in original packaging. Return postage is on us.</p>
              </div>
            </div>
          )}
        </div>

        {/* Related Products */}
        <div className="mt-16 md:mt-40">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8 md:mb-12">
            <div>
              <span className="text-xs font-label text-secondary font-bold uppercase tracking-widest mb-2 block">Complete the Look</span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-headline font-extrabold tracking-tighter">Customers also bought</h2>
            </div>
            <Link to="/shop" className="text-sm font-label font-bold uppercase tracking-widest underline underline-offset-8 decoration-secondary shrink-0">View Collection</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {allProducts.filter((p) => p.id !== product.id).slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
    </ShellMain>
  );
};

/* ─────────────────────────────────────────────
   SEARCH PAGE — full catalogue index
───────────────────────────────────────────── */
export const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = (searchParams.get("query") ?? "").trim();
  const [draft, setDraft] = useState(qParam);

  useEffect(() => {
    setDraft(qParam);
  }, [qParam]);

  const results = useMemo(() => searchCatalog(allProducts, qParam), [qParam]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next = draft.trim();
    if (next) setSearchParams({ query: next });
    else setSearchParams({});
  };

  return (
    <StorefrontShell>
      <main
        className={`${storefrontScrollRegionClasses} flex flex-col px-4 sm:px-6 md:px-8 max-w-screen-2xl mx-auto w-full min-w-0`}
      >
        <div className="flex flex-col items-center justify-center text-center px-2 py-8 sm:py-12 md:py-16 min-h-[min(56dvh,calc(100dvh-12rem))] shrink-0">
          <header className="mb-5 sm:mb-6 max-w-2xl mx-auto w-full">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-headline font-extrabold tracking-tight text-on-background mb-1">
              Search
            </h1>
            <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed">
              Search every piece in the catalogue by name, category, brand, or keyword.
            </p>
          </header>

          <form onSubmit={onSubmit} className="w-full max-w-xl sm:max-w-2xl md:max-w-3xl mx-auto">
            <label htmlFor="catalog-search" className="sr-only">
              Search products
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xl"
                />
                <input
                  id="catalog-search"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className={`w-full rounded-2xl pl-12 pr-4 py-3.5 sm:py-4 text-base transition-colors ${neutralFieldClass}`}
                  placeholder="Graphic tee, hoodie, oversized, cotton…"
                  type="search"
                  autoComplete="off"
                  autoCapitalize="off"
                />
              </div>
              <button
                type="submit"
                className="shrink-0 bg-secondary text-on-secondary px-8 py-3.5 rounded-2xl font-label font-bold text-sm uppercase tracking-widest hover:opacity-95 transition-opacity"
              >
                Search
              </button>
            </div>
            <p className="mt-2 text-xs text-on-surface-variant">
              {allProducts.length} products indexed
              {qParam ? ` · ${results.length} match${results.length === 1 ? "" : "es"}` : ""}
            </p>
          </form>
        </div>

        <div className="w-full pb-2">
          {!qParam ? (
            <>
              <h2 className="font-headline font-bold text-lg sm:text-xl text-on-background mb-4 sm:mb-6">
                Browse everything
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 sm:gap-x-8 sm:gap-y-16">
                {allProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </>
          ) : results.length > 0 ? (
            <>
              <h2 className="font-headline font-bold text-lg sm:text-xl text-on-background mb-4 sm:mb-6">
                Results for <span className="text-secondary">&ldquo;{qParam}&rdquo;</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 sm:gap-x-8 sm:gap-y-16">
                {results.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 sm:py-24 px-4 rounded-2xl bg-surface-container-low/60 border border-outline-variant/15">
              <Icon name="search_off" className="text-5xl sm:text-6xl text-outline mb-4 mx-auto" />
              <h2 className="font-headline text-xl sm:text-2xl font-bold text-on-background mb-2">No matches</h2>
              <p className="text-on-surface-variant text-sm sm:text-base mb-6 max-w-md mx-auto leading-relaxed">
                Try another keyword or browse the full catalogue.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  setSearchParams({});
                }}
                className="text-secondary font-label font-bold text-sm uppercase tracking-widest underline underline-offset-4 mr-4"
              >
                Clear search
              </button>
              <Link
                to="/shop"
                className="inline-block bg-secondary text-on-secondary px-6 py-3 rounded-xl font-label font-bold text-sm uppercase tracking-widest hover:opacity-95"
              >
                Shop all
              </Link>
            </div>
          )}
        </div>
      </main>
    </StorefrontShell>
  );
};

/* ─────────────────────────────────────────────
   CAMPAIGN PAGE
───────────────────────────────────────────── */
export const CampaignPage = () => {
  const { campaignSlug } = useParams();
  const campaign = campaignBySlug(campaignSlug);
  if (!campaign) {
    return <Navigate to={`/campaigns/${campaigns[0].slug}`} replace />;
  }
  const gridProducts = productsFromSlugs(campaign.products);
  const showProducts = gridProducts.length > 0 ? gridProducts : allProducts;

  return (
    <StorefrontShell>
      <main className={`${storefrontScrollRegionClasses} bg-surface text-on-background font-body min-w-0`}>
        <section className="relative w-full min-h-[42dvh] sm:min-h-[48dvh] md:min-h-[56dvh] lg:h-[min(72dvh,640px)] lg:min-h-0 overflow-hidden bg-primary-container">
          <img
            className="absolute inset-0 w-full h-full object-cover object-center opacity-55 sm:opacity-60"
            src={campaign.heroImageUrl}
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-primary-container/90 md:from-primary-container/82 via-primary-container/35 md:via-transparent to-transparent" />
          <div className="relative h-full min-h-[42dvh] sm:min-h-[48dvh] md:min-h-0 md:h-full max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col justify-end md:justify-center items-start py-10 sm:py-14 md:py-16 lg:py-0">
            <span className="font-label text-tertiary-fixed tracking-[0.35em] uppercase text-[10px] sm:text-xs mb-3 sm:mb-4 font-bold block">
              Seasonal campaign
            </span>
            <h1 className="text-white font-headline text-[1.75rem] leading-tight sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter mb-3 sm:mb-4 md:mb-6 max-w-[18ch] sm:max-w-none">
              {campaign.title}
            </h1>
            <p className="text-white/75 mb-6 md:mb-8 font-light leading-relaxed max-w-lg text-sm sm:text-base">{campaign.subtitle}</p>
            <Link
              to="/shop"
              className="inline-flex items-center justify-center bg-secondary text-on-secondary px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-label font-bold text-xs sm:text-sm uppercase tracking-widest hover:opacity-95 transition-opacity mb-2 md:mb-0 w-full sm:w-auto text-center"
            >
              Shop the edit
            </Link>
          </div>
        </section>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14 md:py-20 pb-mobile-nav w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 sm:mb-12">
            <div>
              <h2 className="font-headline text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-on-background">In this campaign</h2>
              <p className="text-on-surface-variant text-sm sm:text-base mt-1">
                {gridProducts.length > 0
                  ? "Pieces curated for this story — tracked delivery & Tees packaging."
                  : "Browse the full preview catalogue."}
              </p>
            </div>
            <Link
              to="/search"
              className="text-secondary font-label font-bold text-xs sm:text-sm uppercase tracking-widest shrink-0 hover:underline underline-offset-4"
            >
              Search catalogue
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 sm:gap-x-8 sm:gap-y-16">
            {showProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </main>
    </StorefrontShell>
  );
};

/* ─────────────────────────────────────────────
   WISHLIST PAGE
───────────────────────────────────────────── */
export const WishlistPage = () => {
  const wishlist = useCustomerStore((s) => s.wishlist);
  const items = allProducts.filter((p) => wishlist.includes(p.id));

  return (
    <ShellMain>
        <header className="mb-10 md:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline font-extrabold tracking-tighter mb-4">Wishlist</h1>
          <p className="text-on-surface-variant">{items.length} saved item{items.length !== 1 ? "s" : ""}</p>
        </header>
        {items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="text-center py-32">
            <Icon name="favorite_border" className="text-6xl text-outline mb-6" />
            <h2 className="font-headline text-2xl font-bold mb-4">Your wishlist is empty</h2>
            <p className="text-on-surface-variant mb-8">Save items you love to revisit them anytime.</p>
            <Link to="/shop" className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90">
              Shop Now
            </Link>
          </div>
        )}
    </ShellMain>
  );
};

/* ─────────────────────────────────────────────
   BRANDS DIRECTORY
───────────────────────────────────────────── */
export const BrandsIndexPage = () => (
  <ShellMain className="min-w-0">
    <nav className="mb-6">
      <Link to="/shop" className="inline-flex items-center gap-2 text-sm font-label font-bold uppercase tracking-widest text-secondary hover:underline underline-offset-4">
        <Icon name="arrow_back" className="text-lg" />
        Back to shop
      </Link>
    </nav>
    <header className="mb-8 sm:mb-12 max-w-2xl">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-extrabold tracking-tight text-on-background mb-2">
        Brands
      </h1>
      <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed">
        Houses and studios behind the edit — each with a distinct point of view.
      </p>
    </header>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
      {brandDirectory.map((b) => (
        <Link
          key={b.slug}
          to={`/brands/${b.slug}`}
          className="group flex flex-col rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container-lowest hover:border-secondary/25 hover:shadow-[0_20px_48px_rgba(11,28,48,0.08)] transition-all"
        >
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-container-low">
            <img
              src={b.heroImage}
              alt=""
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary-container/70 via-transparent to-transparent" />
            <span className="absolute bottom-4 left-4 font-label text-[10px] uppercase tracking-[0.2em] text-white/90 font-bold">
              Brand
            </span>
          </div>
          <div className="p-5 sm:p-6 flex flex-col flex-1">
            <h2 className="font-headline text-xl sm:text-2xl font-extrabold text-on-background group-hover:text-secondary transition-colors">
              {b.name}
            </h2>
            <p className="text-on-surface-variant text-sm mt-2 leading-relaxed flex-1">{b.tagline}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-secondary font-label font-bold text-xs uppercase tracking-widest">
              View collection
              <Icon name="arrow_forward" className="text-sm group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  </ShellMain>
);

/* ─────────────────────────────────────────────
   BRAND DETAIL — full brand story + catalogue slice
───────────────────────────────────────────── */
export const BrandPage = () => {
  const { brandSlug } = useParams();
  const slug = brandSlug ?? "";
  const meta = brandDirectoryBySlug[slug];
  const titleCase = (s: string) =>
    s
      .split(/[-\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  const displayName = meta?.name ?? (titleCase(slug) || "Brand");
  const brandProducts = allProducts.filter((p) => brandSlugFromName(p.brand ?? "Tees") === slug);

  return (
    <ShellMain className="min-w-0">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs sm:text-sm font-label text-outline uppercase tracking-widest">
        <Link to="/shop" className="hover:text-secondary transition-colors">
          Shop
        </Link>
        <Icon name="chevron_right" className="text-[10px]" />
        <Link to="/brands" className="hover:text-secondary transition-colors">
          Brands
        </Link>
        <Icon name="chevron_right" className="text-[10px]" />
        <span className="text-on-surface normal-case tracking-normal font-body">{displayName}</span>
      </nav>

      <section className="relative w-full overflow-hidden rounded-2xl border border-outline-variant/20 bg-primary-container min-h-[38dvh] sm:min-h-[44dvh] md:min-h-[360px] mb-8 sm:mb-12">
        <img
          src={meta?.heroImage ?? brandProducts[0]?.imageUrl ?? featuredProducts[0].imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-primary-container/92 md:from-primary-container/88 via-primary-container/45 to-transparent" />
        <div className="relative z-[1] flex flex-col justify-end md:justify-center min-h-[38dvh] sm:min-h-[44dvh] md:min-h-[360px] px-5 sm:px-8 md:px-12 py-8 sm:py-10 md:py-12 max-w-3xl">
          <span className="font-label text-tertiary-fixed text-[10px] sm:text-xs uppercase tracking-[0.25em] font-bold mb-2 sm:mb-3">
            Maison
          </span>
          <h1 className="text-white font-headline text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tighter mb-3 sm:mb-4">
            {displayName}
          </h1>
          <p className="text-white/80 text-sm sm:text-base leading-relaxed max-w-xl">
            {meta?.tagline ?? `Discover pieces from ${displayName} in our curated catalogue.`}
          </p>
        </div>
      </section>

      {meta && (
        <section className="mb-10 sm:mb-14 max-w-3xl">
          <h2 className="font-headline text-lg sm:text-xl font-bold text-on-background mb-3">The house</h2>
          <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed">{meta.story}</p>
        </section>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <h2 className="font-headline text-lg sm:text-2xl font-extrabold text-on-background">
          Shop {displayName}
          <span className="block sm:inline sm:ml-2 text-on-surface-variant text-sm sm:text-base font-normal font-body mt-1 sm:mt-0">
            {brandProducts.length} piece{brandProducts.length === 1 ? "" : "s"}
          </span>
        </h2>
        <Link
          to="/search"
          className="text-secondary font-label font-bold text-xs uppercase tracking-widest shrink-0 hover:underline underline-offset-4"
        >
          Search catalogue
        </Link>
      </div>

      {brandProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 sm:gap-x-8 sm:gap-y-16">
          {brandProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-10 text-center">
          <p className="text-on-surface-variant text-sm sm:text-base mb-4">No products are linked to this brand yet.</p>
          <Link to="/brands" className="text-secondary font-bold text-sm uppercase tracking-widest hover:underline">
            All brands
          </Link>
        </div>
      )}
    </ShellMain>
  );
};
