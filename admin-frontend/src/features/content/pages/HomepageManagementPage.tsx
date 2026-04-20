import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";

import { PageHeader } from "@/components/primitives/PageHeader";
import { ContentWorkspaceNav } from "@/components/stitch/ContentWorkspaceNav";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  createContentMediaUploadIntent,
  getAdminHomepageDraft,
  publishAdminHomepage,
  unpublishAdminHomepage,
  updateAdminHomepageDraft,
  type AdminHomepageDraftEntity,
  type HomepageBrandSpotlightDraft,
  type HomepageCampaignSpotlightDraft,
  type HomepageCategoryTileDraft,
  type HomepageFeaturedProductDraft,
  type HomepageOptionBrand,
  type HomepageOptionCampaign,
  type HomepageOptionCategory,
  type HomepageOptionProduct,
  type HomepagePromoOfferDraft,
  type HomepageSectionHeader,
  type HomepageTestimonialDraft,
  type HomepageTrustBadgeDraft,
  type UpdateHomepageDraftBody
} from "@/features/content/api/admin-content.api";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { postSignedCloudinaryDirectUpload } from "@/lib/media/cloudinaryDirectUpload";

const shellCardClass = "rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm";
const inputClass =
  "w-full rounded-lg border border-[#d7dce5] bg-white px-3 py-2.5 text-sm text-[#181b25] outline-none transition focus:border-[#1653cc] focus:ring-2 focus:ring-[#1653cc]/10";
const textareaClass = `${inputClass} min-h-[108px] resize-y`;
const smallButtonClass =
  "rounded-lg border border-[#d7dce5] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#434654] transition hover:border-[#1653cc]/30 hover:text-[#1653cc]";
const primaryButtonClass =
  "rounded-lg bg-[#1653cc] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1247b2] disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass =
  "rounded-lg border border-[#f0c7c7] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#ba1a1a] transition hover:bg-[#fff5f5]";
const uploadButtonClass =
  "w-full rounded-lg border border-[#1653cc]/25 bg-white px-3 py-2.5 text-sm font-semibold text-[#1653cc] transition hover:bg-[#f2f3ff] disabled:cursor-not-allowed disabled:opacity-60";
const uploadHintClass = "mt-1 text-xs text-[#737685]";
const HOMEPAGE_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const HOMEPAGE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const removeStatus = (entity: AdminHomepageDraftEntity): UpdateHomepageDraftBody => {
  const { status: _status, ...draft } = entity;
  return draft;
};

const moveItem = <T,>(items: T[], fromIndex: number, direction: -1 | 1) => {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

const sectionHeaderKeys: Array<keyof UpdateHomepageDraftBody["sectionHeaders"]> = [
  "category",
  "featured",
  "brand",
  "campaign",
  "promo",
  "testimonial"
];

const normalizeNullableText = (value?: string | null) => {
  if (value == null) {
    return null;
  }

  return value.trim().length > 0 ? value : null;
};

const normalizeDraftForSave = (draft: UpdateHomepageDraftBody): UpdateHomepageDraftBody => ({
  ...draft,
  hero: {
    ...draft.hero,
    titleAccent: normalizeNullableText(draft.hero.titleAccent),
    titleSuffix: normalizeNullableText(draft.hero.titleSuffix),
    backgroundImageAlt: normalizeNullableText(draft.hero.backgroundImageAlt)
  },
  sectionHeaders: Object.fromEntries(
    sectionHeaderKeys.map((key) => [
      key,
      {
        ...draft.sectionHeaders[key],
        ctaLabel: normalizeNullableText(draft.sectionHeaders[key].ctaLabel),
        ctaHref: normalizeNullableText(draft.sectionHeaders[key].ctaHref)
      }
    ])
  ) as UpdateHomepageDraftBody["sectionHeaders"],
  trustBadges: draft.trustBadges.map((item) => ({
    ...item,
    href: normalizeNullableText(item.href),
    ariaLabel: normalizeNullableText(item.ariaLabel)
  })),
  testimonials: draft.testimonials.map((item) => ({
    ...item,
    statusLabel: normalizeNullableText(item.statusLabel)
  }))
});

const emptyDraft: UpdateHomepageDraftBody = {
  hero: {
    eyebrow: "Storefront homepage",
    titlePrefix: "",
    titleAccent: "",
    titleSuffix: "",
    body: "",
    primaryCtaLabel: "",
    primaryCtaHref: "/shop",
    backgroundImageUrl: "",
    backgroundImageAlt: ""
  },
  sectionHeaders: {
    category: { isVisible: true, eyebrow: "", title: "", description: "", ctaLabel: "", ctaHref: "" },
    featured: { isVisible: true, eyebrow: "", title: "", description: "", ctaLabel: "", ctaHref: "" },
    brand: { isVisible: true, eyebrow: "", title: "", description: "", ctaLabel: "", ctaHref: "" },
    campaign: { isVisible: true, eyebrow: "", title: "", description: "", ctaLabel: "", ctaHref: "" },
    promo: { isVisible: true, eyebrow: "", title: "", description: "", ctaLabel: "", ctaHref: "" },
    testimonial: { isVisible: true, eyebrow: "", title: "", description: "", ctaLabel: "", ctaHref: "" }
  },
  trustBadges: [],
  categoryTiles: [],
  featuredProducts: [],
  brandSpotlights: [],
  campaignSpotlights: [],
  promoOffers: [],
  testimonials: []
};

export const HomepageManagementPage = () => {
  const accessToken = useAdminAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<UpdateHomepageDraftBody>(emptyDraft);
  const [status, setStatus] = useState<AdminHomepageDraftEntity["status"] | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const homepageQuery = useAuthedQuery(
  ["admin-homepage-draft"],
  (token) => getAdminHomepageDraft(token)
);

  useEffect(() => {
    const entity = homepageQuery.data?.data.entity;
    if (!entity) {
      return;
    }
    setDraft(removeStatus(entity));
    setStatus(entity.status);
  }, [homepageQuery.data]);

  const options = homepageQuery.data?.data.options;

  const saveMutation = useMutation({
    mutationFn: async (body: UpdateHomepageDraftBody) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return updateAdminHomepageDraft(accessToken, normalizeDraftForSave(body));
    },
    onSuccess: (response) => {
      setFeedback("Draft saved.");
      setDraft(removeStatus(response.data.entity));
      setStatus(response.data.entity.status);
      void queryClient.invalidateQueries({ queryKey: ["admin-homepage-draft"] });
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Save failed.");
    }
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return publishAdminHomepage(accessToken);
    },
    onSuccess: (response) => {
      setFeedback("Homepage published.");
      setDraft(removeStatus(response.data.entity));
      setStatus(response.data.entity.status);
      void queryClient.invalidateQueries({ queryKey: ["admin-homepage-draft"] });
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Publish failed."
      );
    }
  });

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return unpublishAdminHomepage(accessToken);
    },
    onSuccess: (response) => {
      setFeedback("Homepage unpublished.");
      setDraft(removeStatus(response.data.entity));
      setStatus(response.data.entity.status);
      void queryClient.invalidateQueries({ queryKey: ["admin-homepage-draft"] });
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Unpublish failed."
      );
    }
  });

  const productOptions = options?.products ?? [];
  const categoryOptions = options?.categories ?? [];
  const brandOptions = options?.brands ?? [];
  const campaignOptions = options?.campaigns ?? [];

  const productTitleById = useMemo(
    () => new Map(productOptions.map((product) => [product.id, product.title])),
    [productOptions]
  );

  const setSectionHeader = (
    key: keyof UpdateHomepageDraftBody["sectionHeaders"],
    nextHeader: HomepageSectionHeader
  ) => {
    setDraft((current) => ({
      ...current,
      sectionHeaders: {
        ...current.sectionHeaders,
        [key]: nextHeader
      }
    }));
  };

  const pageActionsDisabled =
    homepageQuery.isLoading ||
    saveMutation.isPending ||
    publishMutation.isPending ||
    unpublishMutation.isPending;

  if (homepageQuery.isLoading && !homepageQuery.data) {
    return <div className="p-8 text-sm text-[#5b5e68]">Loading homepage workspace…</div>;
  }

  if (homepageQuery.isError) {
    const message =
      homepageQuery.error instanceof ApiError
        ? homepageQuery.error.message
        : homepageQuery.error instanceof Error
          ? homepageQuery.error.message
          : "The homepage workspace could not be loaded.";

    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ContentWorkspaceNav />

      <PageHeader
        title="Homepage"
        description="Control every customer-homepage section from one typed content workspace."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-homepage-draft"])]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={smallButtonClass}
              disabled={pageActionsDisabled}
              onClick={() => saveMutation.mutate(draft)}
            >
              Save Draft
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={pageActionsDisabled}
              onClick={() => publishMutation.mutate()}
            >
              Publish Homepage
            </button>
            <button
              type="button"
              className={dangerButtonClass}
              disabled={pageActionsDisabled || !status?.hasPublishedVersion}
              onClick={() => unpublishMutation.mutate()}
            >
              Unpublish
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e5e7eb] bg-[#f8f9fb] px-4 py-3 text-sm text-[#434654]">
        <span className="font-semibold">Draft updated:</span>
        <span>{status?.draftUpdatedAt ? new Date(status.draftUpdatedAt).toLocaleString() : "Not available"}</span>
        <span className="font-semibold">Published:</span>
        <span>{status?.publishedAt ? new Date(status.publishedAt).toLocaleString() : "Not published"}</span>
      </div>

      {feedback ? (
        <div className="rounded-xl border border-[#c7d7f8] bg-[#f4f8ff] px-4 py-3 text-sm text-[#1653cc]">
          {feedback}
        </div>
      ) : null}

      <section className={shellCardClass}>
        <SectionHeading
          title="Homepage Layout Structure"
          description="Order aligned to your approved structure: Hero, Featured, Editor's Pick, New Arrivals, Brand, Category, Promotions, Product Reviews, Testimonies."
        />
        <ol className="grid gap-2 text-sm text-[#434654] md:grid-cols-2">
          <li>1. Hero section</li>
          <li>2. Featured products (up to 10)</li>
          <li>3. Editor&apos;s pick (campaign spotlight banners)</li>
          <li>4. New arrivals (latest uploaded products)</li>
          <li>5. Brand section (3 brands)</li>
          <li>6. Category section (3 categories)</li>
          <li>7. Coupon / promotions banners</li>
          <li>8. Product reviews highlights</li>
          <li>9. Testimonies</li>
        </ol>
      </section>

      <section className={shellCardClass}>
        <SectionHeading title="Hero" description="Main above-the-fold message and primary CTA." />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Eyebrow"
            value={draft.hero.eyebrow}
            onChange={(value) => setDraft((current) => ({ ...current, hero: { ...current.hero, eyebrow: value } }))}
          />
          <TextField
            label="CTA Label"
            value={draft.hero.primaryCtaLabel}
            onChange={(value) =>
              setDraft((current) => ({ ...current, hero: { ...current.hero, primaryCtaLabel: value } }))
            }
          />
          <TextField
            label="Title Prefix"
            value={draft.hero.titlePrefix}
            onChange={(value) =>
              setDraft((current) => ({ ...current, hero: { ...current.hero, titlePrefix: value } }))
            }
          />
          <TextField
            label="Title Accent"
            value={draft.hero.titleAccent ?? ""}
            onChange={(value) =>
              setDraft((current) => ({ ...current, hero: { ...current.hero, titleAccent: value } }))
            }
          />
          <TextField
            label="Title Suffix"
            value={draft.hero.titleSuffix ?? ""}
            onChange={(value) =>
              setDraft((current) => ({ ...current, hero: { ...current.hero, titleSuffix: value } }))
            }
          />
          <TextField
            label="CTA Href"
            value={draft.hero.primaryCtaHref}
            onChange={(value) =>
              setDraft((current) => ({ ...current, hero: { ...current.hero, primaryCtaHref: value } }))
            }
          />
        </div>
        <div className="mt-4">
          <TextAreaField
            label="Body"
            value={draft.hero.body}
            onChange={(value) => setDraft((current) => ({ ...current, hero: { ...current.hero, body: value } }))}
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ImageUploadField
            accessToken={accessToken}
            label="Background Image"
            value={draft.hero.backgroundImageUrl}
            onChange={(value) =>
              setDraft((current) => ({ ...current, hero: { ...current.hero, backgroundImageUrl: value } }))
            }
            helperText="Upload hero background (JPG, PNG, WebP; max 8MB)."
          />
          <TextField
            label="Background Image Alt"
            value={draft.hero.backgroundImageAlt ?? ""}
            onChange={(value) =>
              setDraft((current) => ({ ...current, hero: { ...current.hero, backgroundImageAlt: value } }))
            }
          />
        </div>
      </section>

      <section className={shellCardClass}>
        <SectionHeading title="Trust Badges" description="Fast credibility row under the hero." />
        <div className="space-y-4">
          {draft.trustBadges.map((item, index) => (
            <ArrayItemCard
              key={`trust-${index}`}
              title={item.title || `Badge ${index + 1}`}
              index={index}
              count={draft.trustBadges.length}
              onMoveUp={() =>
                setDraft((current) => ({ ...current, trustBadges: moveItem(current.trustBadges, index, -1) }))
              }
              onMoveDown={() =>
                setDraft((current) => ({ ...current, trustBadges: moveItem(current.trustBadges, index, 1) }))
              }
              onRemove={() =>
                setDraft((current) => ({
                  ...current,
                  trustBadges: current.trustBadges.filter((_, currentIndex) => currentIndex !== index)
                }))
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Icon Name"
                  value={item.iconName}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      trustBadges: current.trustBadges.map((entry, currentIndex) =>
                        currentIndex === index ? { ...entry, iconName: value } : entry
                      )
                    }))
                  }
                />
                <TextField
                  label="Link Href"
                  value={item.href ?? ""}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      trustBadges: current.trustBadges.map((entry, currentIndex) =>
                        currentIndex === index ? { ...entry, href: value } : entry
                      )
                    }))
                  }
                />
                <TextField
                  label="Title"
                  value={item.title}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      trustBadges: current.trustBadges.map((entry, currentIndex) =>
                        currentIndex === index ? { ...entry, title: value } : entry
                      )
                    }))
                  }
                />
                <TextField
                  label="ARIA Label"
                  value={item.ariaLabel ?? ""}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      trustBadges: current.trustBadges.map((entry, currentIndex) =>
                        currentIndex === index ? { ...entry, ariaLabel: value } : entry
                      )
                    }))
                  }
                />
              </div>
              <div className="mt-4">
                <TextAreaField
                  label="Subtitle"
                  value={item.subtitle}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      trustBadges: current.trustBadges.map((entry, currentIndex) =>
                        currentIndex === index ? { ...entry, subtitle: value } : entry
                      )
                    }))
                  }
                />
              </div>
            </ArrayItemCard>
          ))}
        </div>
        <div className="mt-4">
          <button
            type="button"
            className={smallButtonClass}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                trustBadges: [
                  ...current.trustBadges,
                  { iconName: "verified_user", title: "", subtitle: "", href: "/about", ariaLabel: "" }
                ]
              }))
            }
          >
            Add Trust Badge
          </button>
        </div>
      </section>

      <SectionHeaderCard
        title="Featured Products (Up To 10)"
        description="Primary featured product grid on homepage."
        header={draft.sectionHeaders.featured}
        onChange={(nextHeader) => setSectionHeader("featured", nextHeader)}
      >
        <SortableProductRows
          items={draft.featuredProducts}
          products={productOptions}
          onChange={(items) => setDraft((current) => ({ ...current, featuredProducts: items }))}
          createEmpty={() => ({ productId: "" })}
          getValue={(item) => item.productId}
          setValue={(item, productId) => ({ ...item, productId })}
        />
      </SectionHeaderCard>

      <SectionHeaderCard
        title="Editor's Pick (Campaign Banners)"
        description="Editorial banner blocks used as editor's pick sections."
        header={draft.sectionHeaders.campaign}
        onChange={(nextHeader) => setSectionHeader("campaign", nextHeader)}
      >
        <div className="space-y-4">
          {draft.campaignSpotlights.map((spotlight, index) => (
            <ArrayItemCard
              key={`campaign-${index}`}
              title={spotlight.title || `Editor's Pick ${index + 1}`}
              index={index}
              count={draft.campaignSpotlights.length}
              onMoveUp={() =>
                setDraft((current) => ({
                  ...current,
                  campaignSpotlights: moveItem(current.campaignSpotlights, index, -1)
                }))
              }
              onMoveDown={() =>
                setDraft((current) => ({
                  ...current,
                  campaignSpotlights: moveItem(current.campaignSpotlights, index, 1)
                }))
              }
              onRemove={() =>
                setDraft((current) => ({
                  ...current,
                  campaignSpotlights: current.campaignSpotlights.filter((_, currentIndex) => currentIndex !== index)
                }))
              }
            >
              <CampaignSpotlightEditor
                accessToken={accessToken}
                item={spotlight}
                campaigns={campaignOptions}
                products={productOptions}
                onChange={(nextValue) =>
                  setDraft((current) => ({
                    ...current,
                    campaignSpotlights: current.campaignSpotlights.map((entry, currentIndex) =>
                      currentIndex === index ? nextValue : entry
                    )
                  }))
                }
              />
            </ArrayItemCard>
          ))}
        </div>
        <div className="mt-4">
          <button
            type="button"
            className={smallButtonClass}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                campaignSpotlights: [
                  ...current.campaignSpotlights,
                  {
                    campaignId: null,
                    slug: "",
                    title: "",
                    subtitle: "",
                    heroImageUrl: "",
                    label: "",
                    ctaLabel: "",
                    layout: "FEATURE",
                    productIds: []
                  }
                ]
              }))
            }
          >
            Add Editor&apos;s Pick Banner
          </button>
        </div>
      </SectionHeaderCard>

      <SectionHeaderCard
        title="New Arrivals"
        description="Auto-managed from newest published products in catalog (latest updates)."
        header={draft.sectionHeaders.featured}
        onChange={(nextHeader) => setSectionHeader("featured", nextHeader)}
      >
        <div className="rounded-xl border border-dashed border-[#d7dce5] bg-[#fbfcff] p-4 text-sm text-[#5b5e68]">
          New arrivals are pulled from recently uploaded/published products and shown on the customer homepage.
          Use the catalog module to update product freshness.
        </div>
      </SectionHeaderCard>

      <SectionHeaderCard
        title="Brand Section (3 Brands)"
        description="Brand banners with direct links and product picks."
        header={draft.sectionHeaders.brand}
        onChange={(nextHeader) => setSectionHeader("brand", nextHeader)}
      >
        <div className="space-y-4">
          {draft.brandSpotlights.map((spotlight, index) => (
            <ArrayItemCard
              key={`brand-${index}`}
              title={spotlight.title || `Brand ${index + 1}`}
              index={index}
              count={draft.brandSpotlights.length}
              onMoveUp={() =>
                setDraft((current) => ({
                  ...current,
                  brandSpotlights: moveItem(current.brandSpotlights, index, -1)
                }))
              }
              onMoveDown={() =>
                setDraft((current) => ({
                  ...current,
                  brandSpotlights: moveItem(current.brandSpotlights, index, 1)
                }))
              }
              onRemove={() =>
                setDraft((current) => ({
                  ...current,
                  brandSpotlights: current.brandSpotlights.filter((_, currentIndex) => currentIndex !== index)
                }))
              }
            >
              <BrandSpotlightEditor
                accessToken={accessToken}
                item={spotlight}
                brands={brandOptions}
                products={productOptions}
                onChange={(nextValue) =>
                  setDraft((current) => ({
                    ...current,
                    brandSpotlights: current.brandSpotlights.map((entry, currentIndex) =>
                      currentIndex === index ? nextValue : entry
                    )
                  }))
                }
              />
            </ArrayItemCard>
          ))}
        </div>
        <div className="mt-4">
          <button
            type="button"
            className={smallButtonClass}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                brandSpotlights: [
                  ...current.brandSpotlights,
                  {
                    brandId: null,
                    slug: "",
                    title: "",
                    tagline: "",
                    heroImageUrl: "",
                    ctaLabel: "",
                    productIds: []
                  }
                ]
              }))
            }
          >
            Add Brand Spotlight
          </button>
        </div>
      </SectionHeaderCard>

      <SectionHeaderCard
        title="Category Section (3 Categories)"
        description="Category banners with direct route links."
        header={draft.sectionHeaders.category}
        onChange={(nextHeader) => setSectionHeader("category", nextHeader)}
      >
        <div className="space-y-4">
          {draft.categoryTiles.map((tile, index) => (
            <ArrayItemCard
              key={`category-${index}`}
              title={tile.title || `Tile ${index + 1}`}
              index={index}
              count={draft.categoryTiles.length}
              onMoveUp={() =>
                setDraft((current) => ({ ...current, categoryTiles: moveItem(current.categoryTiles, index, -1) }))
              }
              onMoveDown={() =>
                setDraft((current) => ({ ...current, categoryTiles: moveItem(current.categoryTiles, index, 1) }))
              }
              onRemove={() =>
                setDraft((current) => ({
                  ...current,
                  categoryTiles: current.categoryTiles.filter((_, currentIndex) => currentIndex !== index)
                }))
              }
            >
              <CategoryTileEditor
                accessToken={accessToken}
                tile={tile}
                categories={categoryOptions}
                onChange={(nextTile) =>
                  setDraft((current) => ({
                    ...current,
                    categoryTiles: current.categoryTiles.map((entry, currentIndex) =>
                      currentIndex === index ? nextTile : entry
                    )
                  }))
                }
              />
            </ArrayItemCard>
          ))}
        </div>
        <div className="mt-4">
          <button
            type="button"
            className={smallButtonClass}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                categoryTiles: [
                  ...current.categoryTiles,
                  { categoryId: null, slug: "", title: "", description: "", imageUrl: "" }
                ]
              }))
            }
          >
            Add Category Tile
          </button>
        </div>
      </SectionHeaderCard>

      <SectionHeaderCard
        title="Coupon / Promotions Banners"
        description="Coupon and promotion banners with direct CTA routing."
        header={draft.sectionHeaders.promo}
        onChange={(nextHeader) => setSectionHeader("promo", nextHeader)}
      >
        <div className="space-y-4">
          {draft.promoOffers.map((offer, index) => (
            <ArrayItemCard
              key={`promo-${index}`}
              title={offer.headline || `Offer ${index + 1}`}
              index={index}
              count={draft.promoOffers.length}
              onMoveUp={() =>
                setDraft((current) => ({ ...current, promoOffers: moveItem(current.promoOffers, index, -1) }))
              }
              onMoveDown={() =>
                setDraft((current) => ({ ...current, promoOffers: moveItem(current.promoOffers, index, 1) }))
              }
              onRemove={() =>
                setDraft((current) => ({
                  ...current,
                  promoOffers: current.promoOffers.filter((_, currentIndex) => currentIndex !== index)
                }))
              }
            >
              <PromoOfferEditor
                accessToken={accessToken}
                item={offer}
                products={productOptions}
                onChange={(nextValue) =>
                  setDraft((current) => ({
                    ...current,
                    promoOffers: current.promoOffers.map((entry, currentIndex) =>
                      currentIndex === index ? nextValue : entry
                    )
                  }))
                }
              />
            </ArrayItemCard>
          ))}
        </div>
        <div className="mt-4">
          <button
            type="button"
            className={smallButtonClass}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                promoOffers: [
                  ...current.promoOffers,
                  {
                    badge: "",
                    code: "",
                    headline: "",
                    body: "",
                    terms: "",
                    bannerImageUrl: "",
                    ctaLabel: "",
                    ctaHref: "/shop",
                    productIds: []
                  }
                ]
              }))
            }
          >
            Add Promo Offer
          </button>
        </div>
      </SectionHeaderCard>

      <SectionHeaderCard
        title="Product Reviews Highlights"
        description="Review-like social proof cards shown before testimonies."
        header={draft.sectionHeaders.testimonial}
        onChange={(nextHeader) => setSectionHeader("testimonial", nextHeader)}
      >
        <div className="rounded-xl border border-dashed border-[#d7dce5] bg-[#fbfcff] p-4 text-sm text-[#5b5e68]">
          This area is powered by testimonial/review entries below. Add quote cards with customer names and status labels.
        </div>
      </SectionHeaderCard>

      <SectionHeaderCard
        title="Testimonies"
        description="Customer testimonies and trust quotes."
        header={draft.sectionHeaders.testimonial}
        onChange={(nextHeader) => setSectionHeader("testimonial", nextHeader)}
      >
        <div className="space-y-4">
          {draft.testimonials.map((item, index) => (
            <ArrayItemCard
              key={`testimonial-${index}`}
              title={item.customerName || `Testimonial ${index + 1}`}
              index={index}
              count={draft.testimonials.length}
              onMoveUp={() =>
                setDraft((current) => ({
                  ...current,
                  testimonials: moveItem(current.testimonials, index, -1)
                }))
              }
              onMoveDown={() =>
                setDraft((current) => ({
                  ...current,
                  testimonials: moveItem(current.testimonials, index, 1)
                }))
              }
              onRemove={() =>
                setDraft((current) => ({
                  ...current,
                  testimonials: current.testimonials.filter((_, currentIndex) => currentIndex !== index)
                }))
              }
            >
              <TestimonialEditor
                accessToken={accessToken}
                item={item}
                onChange={(nextValue) =>
                  setDraft((current) => ({
                    ...current,
                    testimonials: current.testimonials.map((entry, currentIndex) =>
                      currentIndex === index ? nextValue : entry
                    )
                  }))
                }
              />
            </ArrayItemCard>
          ))}
        </div>
        <div className="mt-4">
          <button
            type="button"
            className={smallButtonClass}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                testimonials: [
                  ...current.testimonials,
                  { quote: "", customerName: "", imageUrl: "", statusLabel: "Verified purchase" }
                ]
              }))
            }
          >
            Add Testimonial
          </button>
        </div>
      </SectionHeaderCard>

      <div className="flex justify-end">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={pageActionsDisabled}
          onClick={() => saveMutation.mutate(draft)}
        >
          Save Draft
        </button>
      </div>

      <div className="rounded-xl border border-dashed border-[#d7dce5] bg-[#fbfcff] px-4 py-3 text-xs text-[#5b5e68]">
        Selected products are shown in the current saved order. Product labels use the latest catalog titles, for example:
        {" "}
        {[...productTitleById.values()].slice(0, 3).join(", ")}
      </div>
    </div>
  );
};

const SectionHeading = ({ title, description }: { title: string; description: string }) => (
  <div className="mb-4">
    <h2 className="font-headline text-xl font-bold text-[#181b25]">{title}</h2>
    <p className="mt-1 text-sm text-[#5b5e68]">{description}</p>
  </div>
);

const SectionHeaderCard = ({
  title,
  description,
  header,
  onChange,
  children
}: {
  title: string;
  description: string;
  header: HomepageSectionHeader;
  onChange: (header: HomepageSectionHeader) => void;
  children: ReactNode;
}) => (
  <section className={shellCardClass}>
    <SectionHeading title={title} description={description} />
    <div className="grid gap-4 md:grid-cols-2">
      <TextField label="Eyebrow" value={header.eyebrow} onChange={(value) => onChange({ ...header, eyebrow: value })} />
      <TextField label="Title" value={header.title} onChange={(value) => onChange({ ...header, title: value })} />
      <TextField
        label="CTA Label"
        value={header.ctaLabel ?? ""}
        onChange={(value) => onChange({ ...header, ctaLabel: value })}
      />
      <TextField
        label="CTA Href"
        value={header.ctaHref ?? ""}
        onChange={(value) => onChange({ ...header, ctaHref: value })}
      />
    </div>
    <div className="mt-4">
      <TextAreaField
        label="Description"
        value={header.description}
        onChange={(value) => onChange({ ...header, description: value })}
      />
    </div>
    <div className="mt-4 flex items-center gap-3">
      <input
        id={`toggle-${title}`}
        type="checkbox"
        checked={header.isVisible}
        onChange={(event) => onChange({ ...header, isVisible: event.target.checked })}
      />
      <label htmlFor={`toggle-${title}`} className="text-sm text-[#434654]">
        Show this section on the customer homepage
      </label>
    </div>
    <div className="mt-6">{children}</div>
  </section>
);

const ArrayItemCard = ({
  title,
  index,
  count,
  onMoveUp,
  onMoveDown,
  onRemove,
  children
}: {
  title: string;
  index: number;
  count: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  children: ReactNode;
}) => (
  <div className="rounded-xl border border-[#e5e7eb] bg-[#fbfcff] p-4">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="font-semibold text-[#181b25]">{title}</h3>
        <p className="text-xs text-[#737685]">Item {index + 1} of {count}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" className={smallButtonClass} onClick={onMoveUp} disabled={index === 0}>
          Up
        </button>
        <button type="button" className={smallButtonClass} onClick={onMoveDown} disabled={index === count - 1}>
          Down
        </button>
        <button type="button" className={dangerButtonClass} onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
    {children}
  </div>
);

const CategoryTileEditor = ({
  accessToken,
  tile,
  categories,
  onChange
}: {
  accessToken: string | null;
  tile: HomepageCategoryTileDraft;
  categories: HomepageOptionCategory[];
  onChange: (tile: HomepageCategoryTileDraft) => void;
}) => (
  <div className="grid gap-4 md:grid-cols-2">
    <SelectField
      label="Linked Category"
      value={tile.categoryId ?? ""}
      onChange={(value) => {
        const selected = categories.find((category) => category.id === value);
        onChange({
          ...tile,
          categoryId: value || null,
          slug: selected?.slug ?? tile.slug,
          title: selected?.name ?? tile.title
        });
      }}
      options={[
        { value: "", label: "None" },
        ...categories.map((category) => ({
          value: category.id,
          label: `${category.name} (${category.productCount})`
        }))
      ]}
    />
    <TextField label="Slug" value={tile.slug} onChange={(value) => onChange({ ...tile, slug: value })} />
    <TextField label="Title" value={tile.title} onChange={(value) => onChange({ ...tile, title: value })} />
    <ImageUploadField
      accessToken={accessToken}
      label="Category Image"
      value={tile.imageUrl}
      onChange={(value) => onChange({ ...tile, imageUrl: value })}
      helperText="Upload category tile image."
    />
    <div className="md:col-span-2">
      <TextAreaField
        label="Description"
        value={tile.description}
        onChange={(value) => onChange({ ...tile, description: value })}
      />
    </div>
  </div>
);

const SortableProductRows = <T extends HomepageFeaturedProductDraft>({
  items,
  products,
  onChange,
  createEmpty,
  getValue,
  setValue
}: {
  items: T[];
  products: HomepageOptionProduct[];
  onChange: (items: T[]) => void;
  createEmpty: () => T;
  getValue: (item: T) => string;
  setValue: (item: T, productId: string) => T;
}) => (
  <div className="space-y-4">
    {items.map((item, index) => (
      <ArrayItemCard
        key={`product-row-${index}`}
        title={products.find((product) => product.id === getValue(item))?.title ?? `Product ${index + 1}`}
        index={index}
        count={items.length}
        onMoveUp={() => onChange(moveItem(items, index, -1))}
        onMoveDown={() => onChange(moveItem(items, index, 1))}
        onRemove={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))}
      >
        <SelectField
          label="Product"
          value={getValue(item)}
          onChange={(value) =>
            onChange(items.map((entry, currentIndex) => (currentIndex === index ? setValue(entry, value) : entry)))
          }
          options={products.map((product) => ({
            value: product.id,
            label: `${product.title}${product.brandName ? ` · ${product.brandName}` : ""}`
          }))}
        />
      </ArrayItemCard>
    ))}
    <button type="button" className={smallButtonClass} onClick={() => onChange([...items, createEmpty()])}>
      Add Product
    </button>
  </div>
);

const BrandSpotlightEditor = ({
  accessToken,
  item,
  brands,
  products,
  onChange
}: {
  accessToken: string | null;
  item: HomepageBrandSpotlightDraft;
  brands: HomepageOptionBrand[];
  products: HomepageOptionProduct[];
  onChange: (item: HomepageBrandSpotlightDraft) => void;
}) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <SelectField
        label="Linked Brand"
        value={item.brandId ?? ""}
        onChange={(value) => {
          const selected = brands.find((brand) => brand.id === value);
          onChange({
            ...item,
            brandId: value || null,
            slug: selected?.slug ?? item.slug,
            title: selected?.name ?? item.title,
            ctaLabel: selected ? `Full ${selected.name} collection` : item.ctaLabel
          });
        }}
        options={[{ value: "", label: "None" }, ...brands.map((brand) => ({ value: brand.id, label: brand.name }))]}
      />
      <TextField label="Slug" value={item.slug} onChange={(value) => onChange({ ...item, slug: value })} />
      <TextField label="Title" value={item.title} onChange={(value) => onChange({ ...item, title: value })} />
      <TextField label="CTA Label" value={item.ctaLabel} onChange={(value) => onChange({ ...item, ctaLabel: value })} />
      <ImageUploadField
        accessToken={accessToken}
        label="Hero Image"
        value={item.heroImageUrl}
        onChange={(value) => onChange({ ...item, heroImageUrl: value })}
        helperText="Upload brand spotlight hero image."
      />
      <div className="md:col-span-2">
        <TextAreaField label="Tagline" value={item.tagline} onChange={(value) => onChange({ ...item, tagline: value })} />
      </div>
    </div>
    <MultiProductPicker
      label="Featured Products"
      productIds={item.productIds}
      products={products}
      onChange={(productIds) => onChange({ ...item, productIds })}
    />
  </div>
);

const CampaignSpotlightEditor = ({
  accessToken,
  item,
  campaigns,
  products,
  onChange
}: {
  accessToken: string | null;
  item: HomepageCampaignSpotlightDraft;
  campaigns: HomepageOptionCampaign[];
  products: HomepageOptionProduct[];
  onChange: (item: HomepageCampaignSpotlightDraft) => void;
}) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <SelectField
        label="Linked Campaign"
        value={item.campaignId ?? ""}
        onChange={(value) => {
          const selected = campaigns.find((campaign) => campaign.id === value);
          onChange({
            ...item,
            campaignId: value || null,
            slug: selected?.slug ?? item.slug,
            title: selected?.name ?? item.title
          });
        }}
        options={[
          { value: "", label: "None" },
          ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))
        ]}
      />
      <SelectField
        label="Layout"
        value={item.layout}
        onChange={(value) => onChange({ ...item, layout: value as HomepageCampaignSpotlightDraft["layout"] })}
        options={[
          { value: "FEATURE", label: "Feature" },
          { value: "SPLIT", label: "Split" }
        ]}
      />
      <TextField label="Slug" value={item.slug} onChange={(value) => onChange({ ...item, slug: value })} />
      <TextField label="Label" value={item.label} onChange={(value) => onChange({ ...item, label: value })} />
      <TextField label="Title" value={item.title} onChange={(value) => onChange({ ...item, title: value })} />
      <TextField label="CTA Label" value={item.ctaLabel} onChange={(value) => onChange({ ...item, ctaLabel: value })} />
      <ImageUploadField
        accessToken={accessToken}
        label="Hero Image"
        value={item.heroImageUrl}
        onChange={(value) => onChange({ ...item, heroImageUrl: value })}
        helperText="Upload campaign hero image."
      />
      <div className="md:col-span-2">
        <TextAreaField
          label="Subtitle"
          value={item.subtitle}
          onChange={(value) => onChange({ ...item, subtitle: value })}
        />
      </div>
    </div>
    <MultiProductPicker
      label="Campaign Products"
      productIds={item.productIds}
      products={products}
      onChange={(productIds) => onChange({ ...item, productIds })}
    />
  </div>
);

const PromoOfferEditor = ({
  accessToken,
  item,
  products,
  onChange
}: {
  accessToken: string | null;
  item: HomepagePromoOfferDraft;
  products: HomepageOptionProduct[];
  onChange: (item: HomepagePromoOfferDraft) => void;
}) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <TextField label="Badge" value={item.badge} onChange={(value) => onChange({ ...item, badge: value })} />
      <TextField label="Code" value={item.code} onChange={(value) => onChange({ ...item, code: value })} />
      <TextField
        label="CTA Label"
        value={item.ctaLabel}
        onChange={(value) => onChange({ ...item, ctaLabel: value })}
      />
      <TextField
        label="CTA Href"
        value={item.ctaHref}
        onChange={(value) => onChange({ ...item, ctaHref: value })}
      />
      <ImageUploadField
        accessToken={accessToken}
        label="Banner Image"
        value={item.bannerImageUrl}
        onChange={(value) => onChange({ ...item, bannerImageUrl: value })}
        helperText="Upload promotional banner image."
      />
      <TextField
        label="Headline"
        value={item.headline}
        onChange={(value) => onChange({ ...item, headline: value })}
      />
      <div className="md:col-span-2">
        <TextAreaField label="Body" value={item.body} onChange={(value) => onChange({ ...item, body: value })} />
      </div>
      <div className="md:col-span-2">
        <TextAreaField label="Terms" value={item.terms} onChange={(value) => onChange({ ...item, terms: value })} />
      </div>
    </div>
    <MultiProductPicker
      label="Linked Products"
      productIds={item.productIds}
      products={products}
      onChange={(productIds) => onChange({ ...item, productIds })}
    />
  </div>
);

const TestimonialEditor = ({
  accessToken,
  item,
  onChange
}: {
  accessToken: string | null;
  item: HomepageTestimonialDraft;
  onChange: (item: HomepageTestimonialDraft) => void;
}) => (
  <div className="grid gap-4 md:grid-cols-2">
    <TextField
      label="Customer Name"
      value={item.customerName}
      onChange={(value) => onChange({ ...item, customerName: value })}
    />
    <div>
      <TextField
        label="Status Label"
        value={item.statusLabel ?? ""}
        onChange={(value) => onChange({ ...item, statusLabel: value })}
      />
      <p className="mt-1 text-xs text-[#737685]">
        Include the word &quot;review&quot; in this label to place this card under Product Reviews; otherwise it appears under Testimonies.
      </p>
    </div>
    <ImageUploadField
      accessToken={accessToken}
      label="Customer Image"
      value={item.imageUrl}
      onChange={(value) => onChange({ ...item, imageUrl: value })}
      helperText="Upload customer profile image."
    />
    <div className="md:col-span-2">
      <TextAreaField label="Quote" value={item.quote} onChange={(value) => onChange({ ...item, quote: value })} />
    </div>
  </div>
);

const MultiProductPicker = ({
  label,
  productIds,
  products,
  onChange
}: {
  label: string;
  productIds: string[];
  products: HomepageOptionProduct[];
  onChange: (productIds: string[]) => void;
}) => (
  <div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#737685]">{label}</p>
    <div className="space-y-3">
      {productIds.map((productId, index) => (
        <div key={`${label}-${index}`} className="flex gap-2">
          <select
            value={productId}
            onChange={(event) =>
              onChange(productIds.map((entry, currentIndex) => (currentIndex === index ? event.target.value : entry)))
            }
            className={inputClass}
          >
            <option value="">Select product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
                {product.brandName ? ` · ${product.brandName}` : ""}
              </option>
            ))}
          </select>
          <button type="button" className={smallButtonClass} onClick={() => onChange(moveItem(productIds, index, -1))} disabled={index === 0}>
            Up
          </button>
          <button
            type="button"
            className={smallButtonClass}
            onClick={() => onChange(moveItem(productIds, index, 1))}
            disabled={index === productIds.length - 1}
          >
            Down
          </button>
          <button
            type="button"
            className={dangerButtonClass}
            onClick={() => onChange(productIds.filter((_, currentIndex) => currentIndex !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className={smallButtonClass} onClick={() => onChange([...productIds, ""])}>
        Add Product Slot
      </button>
    </div>
  </div>
);

const TextField = ({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#737685]">{label}</span>
    <input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const TextAreaField = ({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#737685]">{label}</span>
    <textarea className={textareaClass} value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const SelectField = ({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#737685]">{label}</span>
    <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={`${label}-${option.value}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const ImageUploadField = ({
  accessToken,
  label,
  value,
  onChange,
  helperText
}: {
  accessToken: string | null;
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    if (!accessToken) {
      setUploadError("Sign in is required for uploads.");
      return;
    }

    if (!HOMEPAGE_IMAGE_ACCEPT.split(",").includes(file.type)) {
      setUploadError("Use JPG, PNG, or WebP.");
      return;
    }

    if (file.size > HOMEPAGE_IMAGE_MAX_BYTES) {
      setUploadError("Image must be 8MB or smaller.");
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      const intentResponse = await createContentMediaUploadIntent(accessToken, {
        fileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
        resourceType: "image"
      });
      const intent = intentResponse.data.entity;
      const uploadedUrl = await postSignedCloudinaryDirectUpload(intent, file, {
        operation: "media.homepage"
      });
      onChange(uploadedUrl);
    } catch (error) {
      setUploadError(
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Upload failed."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#737685]">{label}</span>
      <div className="space-y-2 rounded-lg border border-[#d7dce5] bg-[#fbfcff] p-3">
        {value ? (
          <img src={value} alt="" className="h-28 w-full rounded-md border border-[#e5e7eb] object-cover" />
        ) : (
          <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-[#d7dce5] text-xs text-[#737685]">
            No image uploaded
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={HOMEPAGE_IMAGE_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void uploadFile(file);
            }
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className={uploadButtonClass}
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? "Uploading image..." : "Upload image"}
        </button>
        {helperText ? <p className={uploadHintClass}>{helperText}</p> : null}
        {uploadError ? <p className="text-xs text-[#ba1a1a]">{uploadError}</p> : null}
      </div>
    </div>
  );
};
