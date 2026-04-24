import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
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
  type AdminHomepageDraftResponse,
  type AdminHomepageDraftEntity,
  type AdminHomepageResolvedPreview,
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
const AUTOSAVE_DELAY_MS = 900;
type HrefOption = { value: string; label: string };
type HomepageSyncState = "idle" | "dirty" | "saving" | "saved" | "conflict";

const commonRouteOptions: HrefOption[] = [
  { value: "/shop", label: "Shop" },
  { value: "/brands", label: "Brands" },
  { value: "/categories", label: "Categories" },
  { value: "/search", label: "Search" },
  { value: "/support", label: "Support" },
  { value: "/about", label: "About" },
  { value: "/contact", label: "Contact" },
  { value: "/pages/shipping-policy", label: "Shipping policy" },
  { value: "/pages/returns-policy", label: "Returns policy" },
  { value: "/pages/privacy-policy", label: "Privacy policy" },
  { value: "/pages/terms", label: "Terms" }
];

const mergeHrefOptions = (options: HrefOption[], currentValue?: string | null): HrefOption[] => {
  const map = new Map(options.map((option) => [option.value, option] as const));
  if (currentValue && !map.has(currentValue)) {
    map.set(currentValue, { value: currentValue, label: `Current: ${currentValue}` });
  }
  return [...map.values()];
};

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTERNAL_HREF_PATTERN = /^\/[a-zA-Z0-9\-._~!$&'()*+,;=:@/%/?]*$/;

const isUuid = (value: string) => UUID_PATTERN.test(value.trim());
const isInternalHref = (value: string) => INTERNAL_HREF_PATTERN.test(value.trim());

const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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
  featuredProducts: draft.featuredProducts
    .map((item) => ({ ...item, productId: item.productId.trim() })),
  brandSpotlights: draft.brandSpotlights.map((item) => ({
    ...item,
    productIds: item.productIds.map((id) => id.trim())
  })),
  campaignSpotlights: draft.campaignSpotlights.map((item) => ({
    ...item,
    productIds: item.productIds.map((id) => id.trim())
  })),
  promoOffers: draft.promoOffers.map((item) => ({
    ...item,
    productIds: item.productIds.map((id) => id.trim())
  })),
  testimonials: draft.testimonials.map((item) => ({
    ...item,
    statusLabel: normalizeNullableText(item.statusLabel)
  }))
});

const serializeDraftSignature = (draft: UpdateHomepageDraftBody) => JSON.stringify(normalizeDraftForSave(draft));

const isManualSection = (header: HomepageSectionHeader) => header.contentMode === "MANUAL";

const readConflictDraftUpdatedAt = (error: ApiError) => {
  const details = (error.payload as { error?: { details?: { currentDraftUpdatedAt?: unknown } } } | null)?.error
    ?.details;
  return typeof details?.currentDraftUpdatedAt === "string" ? details.currentDraftUpdatedAt : null;
};

const validateDraftBeforePublish = (
  draft: UpdateHomepageDraftBody,
  availability: {
    hasProducts: boolean;
    hasCategories: boolean;
    hasBrands: boolean;
    hasCampaigns: boolean;
  }
): string[] => {
  const errors: string[] = [];

  if (!draft.hero.eyebrow.trim()) errors.push("Hero eyebrow is required.");
  if (!draft.hero.titlePrefix.trim()) errors.push("Hero title prefix is required.");
  if (!draft.hero.body.trim()) errors.push("Hero body is required.");
  if (!draft.hero.primaryCtaLabel.trim()) errors.push("Hero CTA label is required.");
  if (!isInternalHref(draft.hero.primaryCtaHref)) errors.push("Hero CTA route must be an internal path starting with '/'.");
  if (!isHttpUrl(draft.hero.backgroundImageUrl)) errors.push("Hero background image must be a valid image URL.");

  if (draft.trustBadges.length > 8) errors.push("Trust badges cannot exceed 8.");
  if (draft.categoryTiles.length > 8) errors.push("Category tiles cannot exceed 8.");
  if (draft.featuredProducts.length > 12) errors.push("Featured products cannot exceed 12.");
  if (draft.brandSpotlights.length > 6) errors.push("Brand spotlights cannot exceed 6.");
  if (draft.campaignSpotlights.length > 4) errors.push("Campaign spotlights cannot exceed 4.");
  if (draft.promoOffers.length > 6) errors.push("Promo offers cannot exceed 6.");
  if (draft.testimonials.length > 6) errors.push("Testimonials cannot exceed 6.");

  if (
    draft.sectionHeaders.category.isVisible &&
    isManualSection(draft.sectionHeaders.category) &&
    draft.categoryTiles.length === 0 &&
    availability.hasCategories
  ) {
    errors.push("Category section is visible but has no category tiles.");
  }
  if (
    draft.sectionHeaders.featured.isVisible &&
    isManualSection(draft.sectionHeaders.featured) &&
    draft.featuredProducts.length === 0 &&
    availability.hasProducts
  ) {
    errors.push("Featured section is visible but has no featured products.");
  }
  if (
    draft.sectionHeaders.brand.isVisible &&
    isManualSection(draft.sectionHeaders.brand) &&
    draft.brandSpotlights.length === 0 &&
    availability.hasBrands
  ) {
    errors.push("Brand section is visible but has no brand spotlights.");
  }
  if (
    draft.sectionHeaders.campaign.isVisible &&
    isManualSection(draft.sectionHeaders.campaign) &&
    draft.campaignSpotlights.length === 0 &&
    availability.hasCampaigns
  ) {
    errors.push("Campaign section is visible but has no campaign spotlights.");
  }
  if (draft.sectionHeaders.promo.isVisible && draft.promoOffers.length === 0) {
    errors.push("Promotions section is visible but has no promo offers.");
  }
  if (draft.sectionHeaders.testimonial.isVisible && draft.testimonials.length === 0) {
    errors.push("Testimonials section is visible but has no customer proof entries.");
  }

  for (const [sectionKey, header] of Object.entries(draft.sectionHeaders)) {
    if (!header.eyebrow.trim()) errors.push(`${sectionKey} section eyebrow is required.`);
    if (!header.title.trim()) errors.push(`${sectionKey} section title is required.`);
    if (!header.description.trim()) errors.push(`${sectionKey} section description is required.`);
    if (header.ctaHref && !isInternalHref(header.ctaHref)) {
      errors.push(`${sectionKey} section CTA route must be an internal path.`);
    }
  }

  for (const badge of draft.trustBadges) {
    if (badge.href && !isInternalHref(badge.href)) {
      errors.push(`Trust badge "${badge.title}" has an invalid route.`);
    }
  }

  if (isManualSection(draft.sectionHeaders.featured)) {
    draft.featuredProducts.forEach((item, index) => {
      if (!isUuid(item.productId)) {
        errors.push(`Featured product #${index + 1} has an invalid product selection.`);
      }
    });
  }

  if (isManualSection(draft.sectionHeaders.brand)) {
    draft.brandSpotlights.forEach((item, index) => {
      if (!item.slug.trim()) errors.push(`Brand spotlight #${index + 1} slug is required.`);
      if (!isHttpUrl(item.heroImageUrl)) errors.push(`Brand spotlight #${index + 1} hero image URL is invalid.`);
      if (!item.ctaLabel.trim()) errors.push(`Brand spotlight #${index + 1} CTA label is required.`);
      if (item.productIds.length > 6) errors.push(`Brand spotlight #${index + 1} cannot exceed 6 products.`);
      item.productIds.forEach((productId) => {
        if (!isUuid(productId)) errors.push(`Brand spotlight #${index + 1} has an invalid product ID.`);
      });
    });
  }

  if (isManualSection(draft.sectionHeaders.campaign)) {
    draft.campaignSpotlights.forEach((item, index) => {
      if (!item.slug.trim()) errors.push(`Campaign spotlight #${index + 1} slug is required.`);
      if (!isHttpUrl(item.heroImageUrl)) errors.push(`Campaign spotlight #${index + 1} hero image URL is invalid.`);
      if (!item.label.trim()) errors.push(`Campaign spotlight #${index + 1} label is required.`);
      if (!item.ctaLabel.trim()) errors.push(`Campaign spotlight #${index + 1} CTA label is required.`);
      if (item.productIds.length > 6) errors.push(`Campaign spotlight #${index + 1} cannot exceed 6 products.`);
      item.productIds.forEach((productId) => {
        if (!isUuid(productId)) errors.push(`Campaign spotlight #${index + 1} has an invalid product ID.`);
      });
    });
  }

  draft.promoOffers.forEach((item, index) => {
    if (!item.badge.trim()) errors.push(`Promotion #${index + 1} badge is required.`);
    if (!item.code.trim()) errors.push(`Promotion #${index + 1} code is required.`);
    if (!item.headline.trim()) errors.push(`Promotion #${index + 1} headline is required.`);
    if (!item.body.trim()) errors.push(`Promotion #${index + 1} body is required.`);
    if (!item.terms.trim()) errors.push(`Promotion #${index + 1} terms are required.`);
    if (!isInternalHref(item.ctaHref)) errors.push(`Promotion #${index + 1} CTA route must be an internal path.`);
    if (!isHttpUrl(item.bannerImageUrl)) errors.push(`Promotion #${index + 1} banner image URL is invalid.`);
    if (item.productIds.length > 6) errors.push(`Promotion #${index + 1} cannot exceed 6 products.`);
    item.productIds.forEach((productId) => {
      if (!isUuid(productId)) errors.push(`Promotion #${index + 1} has an invalid product ID.`);
    });
  });

  draft.testimonials.forEach((item, index) => {
    if (!item.customerName.trim()) errors.push(`Testimony #${index + 1} customer name is required.`);
    if (!item.quote.trim()) errors.push(`Testimony #${index + 1} quote is required.`);
    if (!isHttpUrl(item.imageUrl)) errors.push(`Testimony #${index + 1} image URL is invalid.`);
  });

  return Array.from(new Set(errors));
};

const emptyDraft: UpdateHomepageDraftBody = {
  hero: {
    eyebrow: "Homepage",
    titlePrefix: "",
    titleAccent: "",
    titleSuffix: "",
    body: "",
    primaryCtaLabel: "Shop now",
    primaryCtaHref: "/shop",
    backgroundImageUrl: "",
    backgroundImageAlt: ""
  },
  sectionHeaders: {
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
      ctaLabel: "",
      ctaHref: ""
    },
    testimonial: {
      isVisible: false,
      contentMode: "MANUAL",
      eyebrow: "Social proof",
      title: "Customer Feedback",
      description: "Verified customer testimonials shown on the homepage.",
      ctaLabel: "",
      ctaHref: ""
    }
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
  const [draft, setDraft] = useState<UpdateHomepageDraftBody>(emptyDraft);
  const [status, setStatus] = useState<AdminHomepageDraftEntity["status"] | null>(null);
  const [resolvedPreview, setResolvedPreview] = useState<AdminHomepageResolvedPreview | null>(null);
  const [resolverWarnings, setResolverWarnings] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [syncState, setSyncState] = useState<HomepageSyncState>("idle");
  const [conflictDraftUpdatedAt, setConflictDraftUpdatedAt] = useState<string | null>(null);
  const lastSyncedSignatureRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const previousDraftSignatureRef = useRef<string | null>(null);

  const homepageQuery = useAuthedQuery(["admin-homepage-draft"], (token) => getAdminHomepageDraft(token));

  const options = homepageQuery.data?.data.options;
  const productOptions = options?.products ?? [];
  const categoryOptions = options?.categories ?? [];
  const brandOptions = options?.brands ?? [];
  const campaignOptions = options?.campaigns ?? [];
  const brandHrefOptions = useMemo(
    () =>
      brandOptions.map((brand) => ({
        value: `/brands/${brand.slug}`,
        label: `Brand: ${brand.name}`
      })),
    [brandOptions]
  );
  const categoryHrefOptions = useMemo(
    () =>
      categoryOptions.map((category) => ({
        value: `/categories/${category.slug}`,
        label: `Category: ${category.name}`
      })),
    [categoryOptions]
  );
  const campaignHrefOptions = useMemo(
    () =>
      campaignOptions.map((campaign) => ({
        value: `/campaigns/${campaign.slug}`,
        label: `Campaign: ${campaign.name}`
      })),
    [campaignOptions]
  );
  const productHrefOptions = useMemo(
    () =>
      productOptions.map((product) => ({
        value: `/products/${product.slug}`,
        label: `Product: ${product.title}`
      })),
    [productOptions]
  );
  const sectionCtaHrefOptions = useMemo(
    () => [...commonRouteOptions, ...categoryHrefOptions, ...brandHrefOptions, ...campaignHrefOptions],
    [brandHrefOptions, campaignHrefOptions, categoryHrefOptions]
  );
  const trustBadgeHrefOptions = useMemo(
    () => [...commonRouteOptions, ...categoryHrefOptions, ...brandHrefOptions],
    [brandHrefOptions, categoryHrefOptions]
  );
  const promoHrefOptions = useMemo(
    () => [...commonRouteOptions, ...categoryHrefOptions, ...brandHrefOptions, ...campaignHrefOptions, ...productHrefOptions],
    [brandHrefOptions, campaignHrefOptions, categoryHrefOptions, productHrefOptions]
  );

  const productTitleById = useMemo(
    () => new Map(productOptions.map((product) => [product.id, product.title])),
    [productOptions]
  );
  const draftSignature = useMemo(() => serializeDraftSignature(draft), [draft]);

  const applyWorkspaceResponse = (response: AdminHomepageDraftResponse) => {
    const entity = response.data.entity;
    const nextDraft = removeStatus(entity);
    setDraft(nextDraft);
    setStatus(entity.status);
    setResolvedPreview(response.data.resolvedPreview);
    setResolverWarnings(response.data.warnings);
    setValidationIssues([]);
    setConflictDraftUpdatedAt(null);
    lastSyncedSignatureRef.current = serializeDraftSignature(nextDraft);
    setSyncState("saved");
  };

  useEffect(() => {
    if (!homepageQuery.data) {
      return;
    }
    applyWorkspaceResponse(homepageQuery.data);
  }, [homepageQuery.dataUpdatedAt, homepageQuery.data]);

  useEffect(() => {
    if (previousDraftSignatureRef.current && previousDraftSignatureRef.current !== draftSignature && validationIssues.length > 0) {
      setValidationIssues([]);
    }
    previousDraftSignatureRef.current = draftSignature;
  }, [draftSignature, validationIssues.length]);

  const saveMutation = useMutation({
    retry: false,
    mutationFn: async (body: UpdateHomepageDraftBody & { expectedDraftUpdatedAt: string }) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return updateAdminHomepageDraft(accessToken, body);
    },
    onMutate: () => {
      setSyncState("saving");
    },
    onSuccess: (response) => {
      setFeedback(null);
      applyWorkspaceResponse(response);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        setConflictDraftUpdatedAt(readConflictDraftUpdatedAt(error));
        setSyncState("conflict");
        setFeedback("Another admin changed the homepage draft. Refresh the workspace before editing or publishing again.");
        return;
      }
      setSyncState("dirty");
      setFeedback(error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Autosave failed.");
    }
  });

  const publishMutation = useMutation({
    retry: false,
    mutationFn: async (body: UpdateHomepageDraftBody & { expectedDraftUpdatedAt: string }) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return publishAdminHomepage(accessToken, body);
    },
    onSuccess: (response) => {
      setFeedback("Homepage published.");
      applyWorkspaceResponse(response);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        setConflictDraftUpdatedAt(readConflictDraftUpdatedAt(error));
        setSyncState("conflict");
        setFeedback("The draft changed before publish completed. Refresh the workspace and try again.");
        return;
      }
      setFeedback(
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Publish failed."
      );
    }
  });

  const unpublishMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return unpublishAdminHomepage(accessToken);
    },
    onSuccess: (response) => {
      setFeedback("Homepage unpublished.");
      applyWorkspaceResponse(response);
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Unpublish failed."
      );
    }
  });

  useEffect(() => {
    if (
      !accessToken ||
      !status?.draftUpdatedAt ||
      homepageQuery.isLoading ||
      syncState === "conflict" ||
      publishMutation.isPending ||
      unpublishMutation.isPending
    ) {
      return;
    }

    if (draftSignature === lastSyncedSignatureRef.current) {
      return;
    }

    setSyncState((current) => (current === "saving" ? current : "dirty"));

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      if (saveMutation.isPending || !status?.draftUpdatedAt) {
        return;
      }

      void saveMutation.mutate({
        ...normalizeDraftForSave(draft),
        expectedDraftUpdatedAt: status.draftUpdatedAt
      });
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    accessToken,
    draft,
    draftSignature,
    homepageQuery.isLoading,
    publishMutation.isPending,
    saveMutation.isPending,
    status?.draftUpdatedAt,
    syncState,
    unpublishMutation.isPending
  ]);

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
    homepageQuery.isLoading || publishMutation.isPending || unpublishMutation.isPending;
  const publishDisabled =
    pageActionsDisabled || saveMutation.isPending || syncState === "conflict" || !status?.draftUpdatedAt;

  const handlePublish = () => {
    if (!status?.draftUpdatedAt) {
      setFeedback("Homepage draft status is unavailable. Refresh the workspace and try again.");
      return;
    }

    const normalized = normalizeDraftForSave(draft);
    const issues = validateDraftBeforePublish(normalized, {
      hasProducts: productOptions.length > 0,
      hasCategories: categoryOptions.length > 0,
      hasBrands: brandOptions.length > 0,
      hasCampaigns: campaignOptions.length > 0
    });

    if (issues.length > 0) {
      setValidationIssues(issues);
      setFeedback("Resolve the homepage publish issues and try again.");
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    publishMutation.mutate({
      ...normalized,
      expectedDraftUpdatedAt: status.draftUpdatedAt
    });
  };

  const refreshHomepageWorkspace = async () => {
    const response = await homepageQuery.refetch();
    if (!response.data) {
      throw new Error("Homepage workspace refresh returned no entity.");
    }
    applyWorkspaceResponse(response.data);
    setFeedback("Homepage workspace refreshed.");
  };

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
        description="Manage the draft, preview, and publish snapshot that powers the customer storefront homepage."
        actionMenuItems={[
          {
            id: "refresh-homepage-workspace",
            label: "Refresh data",
            onSelect: () => {
              void refreshHomepageWorkspace().catch((error: unknown) => {
                setFeedback(
                  error instanceof ApiError
                    ? error.message
                    : error instanceof Error
                      ? error.message
                      : "Refresh failed."
                );
              });
            }
          }
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              disabled={publishDisabled}
              onClick={handlePublish}
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
        <span className="font-semibold">Sync:</span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
            syncState === "conflict"
              ? "bg-[#fff1f1] text-[#ba1a1a]"
              : syncState === "saving"
                ? "bg-[#eef4ff] text-[#1653cc]"
                : syncState === "dirty"
                  ? "bg-[#fff7e8] text-[#8c5a00]"
                  : "bg-[#edf8f1] text-[#156f42]"
          }`}
        >
          {syncState === "saving"
            ? "Saving"
            : syncState === "dirty"
              ? "Pending autosave"
              : syncState === "conflict"
                ? "Conflict"
                : "Saved"}
        </span>
        {conflictDraftUpdatedAt ? (
          <>
            <span className="font-semibold">Server draft:</span>
            <span>{new Date(conflictDraftUpdatedAt).toLocaleString()}</span>
          </>
        ) : null}
      </div>

      {feedback ? (
        <div className="rounded-xl border border-[#c7d7f8] bg-[#f4f8ff] px-4 py-3 text-sm text-[#1653cc]">
          {feedback}
        </div>
      ) : null}

      {resolverWarnings.length > 0 ? (
        <div className="rounded-xl border border-[#f2d6a5] bg-[#fff9ee] px-4 py-3 text-sm text-[#7a4b00]">
          <p className="font-semibold">Resolver warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {resolverWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {validationIssues.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Resolve these homepage publish issues:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {validationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className={shellCardClass}>
        <SectionHeading
          title="Homepage Layout Structure"
          description="The storefront renders the resolved backend payload in one fixed conversion-first order."
        />
        <ol className="grid gap-2 text-sm text-[#434654] md:grid-cols-2">
          <li>1. Hero section</li>
          <li>2. Trust badges</li>
          <li>3. Featured products</li>
          <li>4. Promotions</li>
          <li>5. Categories</li>
          <li>6. Brands</li>
          <li>7. Campaigns</li>
          <li>8. Testimonials</li>
        </ol>
      </section>

      {resolvedPreview ? <ResolvedPreviewPanel preview={resolvedPreview} /> : null}

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
          <SelectField
            label="CTA Route"
            value={draft.hero.primaryCtaHref}
            onChange={(value) =>
              setDraft((current) => ({ ...current, hero: { ...current.hero, primaryCtaHref: value } }))
            }
            options={mergeHrefOptions(sectionCtaHrefOptions, draft.hero.primaryCtaHref)}
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
                <SelectField
                  label="Link Route"
                  value={item.href ?? ""}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      trustBadges: current.trustBadges.map((entry, currentIndex) =>
                        currentIndex === index ? { ...entry, href: value || null } : entry
                      )
                    }))
                  }
                  options={[
                    { value: "", label: "None" },
                    ...mergeHrefOptions(trustBadgeHrefOptions, item.href)
                  ]}
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
        description="Primary shoppable product grid on the storefront homepage."
        header={draft.sectionHeaders.featured}
        hrefOptions={sectionCtaHrefOptions}
        onChange={(nextHeader) => setSectionHeader("featured", nextHeader)}
        supportsContentMode
        autoSummary="AUTO mode resolves up to 10 published products with real media, inventory, and homepage merchandising priority. Switch to MANUAL only when you need an exact curated sequence."
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
        title="Campaign Spotlights"
        description="Campaign hero blocks that route customers into active campaign pages."
        header={draft.sectionHeaders.campaign}
        hrefOptions={sectionCtaHrefOptions}
        onChange={(nextHeader) => setSectionHeader("campaign", nextHeader)}
        supportsContentMode
        autoSummary="AUTO mode resolves active campaigns that have published banner media. Switch to MANUAL to override the order, copy, and linked products."
      >
        <div className="space-y-4">
          {draft.campaignSpotlights.map((spotlight, index) => (
            <ArrayItemCard
              key={`campaign-${index}`}
              title={spotlight.title || `Campaign ${index + 1}`}
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
                hrefOptions={campaignHrefOptions}
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
            Add Campaign Spotlight
          </button>
        </div>
      </SectionHeaderCard>

      <SectionHeaderCard
        title="Brand Section (3 Brands)"
        description="Brand banners with direct links and product picks."
        header={draft.sectionHeaders.brand}
        hrefOptions={sectionCtaHrefOptions}
        onChange={(nextHeader) => setSectionHeader("brand", nextHeader)}
        supportsContentMode
        autoSummary="AUTO mode resolves active brands that have published products and real media. Switch to MANUAL to hand-pick the brand story and product selection."
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
                hrefOptions={brandHrefOptions}
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
        hrefOptions={sectionCtaHrefOptions}
        onChange={(nextHeader) => setSectionHeader("category", nextHeader)}
        supportsContentMode
        autoSummary="AUTO mode resolves active categories with real media and the strongest catalog density. Switch to MANUAL to set an exact category sequence and copy."
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
                hrefOptions={categoryHrefOptions}
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
        hrefOptions={sectionCtaHrefOptions}
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
                hrefOptions={promoHrefOptions}
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
        title="Testimonials"
        description="Customer proof shown on the storefront as one unified social-proof section."
        header={draft.sectionHeaders.testimonial}
        hrefOptions={sectionCtaHrefOptions}
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

      <div className="rounded-xl border border-dashed border-[#d7dce5] bg-[#fbfcff] px-4 py-3 text-xs text-[#5b5e68]">
        Selected products are shown in the current draft order. Product labels use the latest catalog titles, for example:
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
  hrefOptions,
  onChange,
  supportsContentMode = false,
  autoSummary,
  children
}: {
  title: string;
  description: string;
  header: HomepageSectionHeader;
  hrefOptions: HrefOption[];
  onChange: (header: HomepageSectionHeader) => void;
  supportsContentMode?: boolean;
  autoSummary?: ReactNode;
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
      <SelectField
        label="CTA Route"
        value={header.ctaHref ?? ""}
        onChange={(value) => onChange({ ...header, ctaHref: value || null })}
        options={[{ value: "", label: "None" }, ...mergeHrefOptions(hrefOptions, header.ctaHref)]}
      />
      {supportsContentMode ? (
        <SelectField
          label="Content Source"
          value={header.contentMode}
          onChange={(value) =>
            onChange({
              ...header,
              contentMode: value === "MANUAL" ? "MANUAL" : "AUTO"
            })
          }
          options={[
            { value: "AUTO", label: "Auto from backend data" },
            { value: "MANUAL", label: "Manual CMS entries" }
          ]}
        />
      ) : null}
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
    {supportsContentMode && header.contentMode === "AUTO" ? (
      <div className="mt-6 rounded-xl border border-dashed border-[#c7d7f8] bg-[#f4f8ff] p-4 text-sm text-[#1653cc]">
        {autoSummary}
      </div>
    ) : (
      <div className="mt-6">{children}</div>
    )}
  </section>
);

const ResolvedPreviewPanel = ({ preview }: { preview: AdminHomepageResolvedPreview }) => (
  <section className={shellCardClass}>
    <SectionHeading
      title="Resolved Storefront Preview"
      description="This is the exact backend-resolved payload the storefront will render after publish."
    />
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-[#f8f9fb]">
        <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
          <PreviewImage src={preview.hero.backgroundImageUrl} alt={preview.hero.backgroundImageAlt} className="h-full min-h-[240px]" />
          <div className="p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#737685]">
              {preview.hero.eyebrow || "Hero"}
            </p>
            <h3 className="mt-2 font-headline text-2xl font-bold text-[#181b25]">
              {preview.hero.titlePrefix}
              {preview.hero.titleAccent ? ` ${preview.hero.titleAccent}` : ""}
              {preview.hero.titleSuffix ? ` ${preview.hero.titleSuffix}` : ""}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[#5b5e68]">{preview.hero.body}</p>
            <div className="mt-4 inline-flex items-center rounded-full bg-[#1653cc] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white">
              {preview.hero.primaryCtaLabel} → {preview.hero.primaryCtaHref}
            </div>
          </div>
        </div>
      </div>

      <PreviewSectionCard
        title="Trust badges"
        visible={preview.trustBadges.length > 0}
        itemCount={preview.trustBadges.length}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {preview.trustBadges.map((badge) => (
            <div key={`${badge.iconName}-${badge.title}`} className="rounded-xl border border-[#e5e7eb] bg-[#fbfcff] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#737685]">{badge.iconName}</p>
              <p className="mt-2 font-semibold text-[#181b25]">{badge.title}</p>
              <p className="mt-1 text-sm text-[#5b5e68]">{badge.subtitle}</p>
            </div>
          ))}
        </div>
      </PreviewSectionCard>

      <PreviewSectionCard
        title="Featured products"
        visible={preview.featuredSection.isVisible}
        itemCount={preview.featuredSection.items.length}
      >
        <PreviewProductGrid products={preview.featuredSection.items} />
      </PreviewSectionCard>

      <PreviewSectionCard
        title="Promotions"
        visible={preview.promoSection.isVisible}
        itemCount={preview.promoSection.items.length}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {preview.promoSection.items.map((promo) => (
            <div key={`${promo.code}-${promo.headline}`} className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#fbfcff]">
              <PreviewImage src={promo.bannerImageUrl} alt={promo.headline} className="h-40" />
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#737685]">
                  {promo.badge} · {promo.code}
                </p>
                <p className="mt-2 font-semibold text-[#181b25]">{promo.headline}</p>
                <p className="mt-1 text-sm text-[#5b5e68]">{promo.body}</p>
              </div>
            </div>
          ))}
        </div>
      </PreviewSectionCard>

      <PreviewSectionCard
        title="Categories"
        visible={preview.categorySection.isVisible}
        itemCount={preview.categorySection.items.length}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {preview.categorySection.items.map((category) => (
            <div key={category.slug} className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#fbfcff]">
              <PreviewImage src={category.imageUrl} alt={category.title} className="h-40" />
              <div className="p-4">
                <p className="font-semibold text-[#181b25]">{category.title}</p>
                <p className="mt-1 text-sm text-[#5b5e68]">{category.description}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#737685]">
                  {category.productCount} products
                </p>
              </div>
            </div>
          ))}
        </div>
      </PreviewSectionCard>

      <PreviewSectionCard
        title="Brands"
        visible={preview.brandSection.isVisible}
        itemCount={preview.brandSection.items.length}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {preview.brandSection.items.map((brand) => (
            <div key={brand.slug} className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#fbfcff]">
              <PreviewImage src={brand.heroImageUrl} alt={brand.title} className="h-40" />
              <div className="p-4">
                <p className="font-semibold text-[#181b25]">{brand.title}</p>
                <p className="mt-1 text-sm text-[#5b5e68]">{brand.tagline}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#737685]">
                  {brand.products.length} linked products
                </p>
              </div>
            </div>
          ))}
        </div>
      </PreviewSectionCard>

      <PreviewSectionCard
        title="Campaigns"
        visible={preview.campaignSection.isVisible}
        itemCount={preview.campaignSection.items.length}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {preview.campaignSection.items.map((campaign) => (
            <div key={campaign.slug} className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#fbfcff]">
              <PreviewImage src={campaign.heroImageUrl} alt={campaign.title} className="h-48" />
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#737685]">
                  {campaign.label} · {campaign.layout}
                </p>
                <p className="mt-2 font-semibold text-[#181b25]">{campaign.title}</p>
                <p className="mt-1 text-sm text-[#5b5e68]">{campaign.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </PreviewSectionCard>

      <PreviewSectionCard
        title="Testimonials"
        visible={preview.testimonialSection.isVisible}
        itemCount={preview.testimonialSection.items.length}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {preview.testimonialSection.items.map((testimonial) => (
            <div key={`${testimonial.customerName}-${testimonial.quote}`} className="rounded-xl border border-[#e5e7eb] bg-[#fbfcff] p-4">
              <p className="text-sm italic leading-relaxed text-[#181b25]">&ldquo;{testimonial.quote}&rdquo;</p>
              <p className="mt-3 font-semibold text-[#181b25]">{testimonial.customerName}</p>
              <p className="text-xs uppercase tracking-[0.16em] text-[#737685]">{testimonial.statusLabel}</p>
            </div>
          ))}
        </div>
      </PreviewSectionCard>
    </div>
  </section>
);

const PreviewSectionCard = ({
  title,
  visible,
  itemCount,
  children
}: {
  title: string;
  visible: boolean;
  itemCount: number;
  children: ReactNode;
}) => (
  <div className="rounded-2xl border border-[#e5e7eb] bg-[#f8f9fb] p-4">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="font-semibold text-[#181b25]">{title}</h3>
        <p className="text-xs uppercase tracking-[0.16em] text-[#737685]">
          {visible ? "Visible on storefront" : "Hidden on storefront"} · {itemCount} item{itemCount === 1 ? "" : "s"}
        </p>
      </div>
    </div>
    {itemCount > 0 ? children : <p className="text-sm text-[#5b5e68]">No resolved content for this section.</p>}
  </div>
);

const PreviewProductGrid = ({ products }: { products: AdminHomepageResolvedPreview["featuredSection"]["items"] }) => (
  <div className="grid gap-4 md:grid-cols-4">
    {products.map((product) => (
      <div key={product.id} className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#fbfcff]">
        <PreviewImage src={product.imageUrl} alt={product.name} className="h-40" />
        <div className="p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[#737685]">{product.category}</p>
          <p className="mt-1 font-semibold text-[#181b25]">{product.name}</p>
          <p className="mt-1 text-sm text-[#5b5e68]">{product.brand ?? "Catalog"}</p>
        </div>
      </div>
    ))}
  </div>
);

const PreviewImage = ({
  src,
  alt,
  className
}: {
  src: string;
  alt: string;
  className?: string;
}) =>
  src ? (
    <img src={src} alt={alt} className={`w-full object-cover ${className ?? ""}`.trim()} />
  ) : (
    <div className={`flex w-full items-center justify-center bg-[#eef2f6] text-xs font-semibold uppercase tracking-[0.16em] text-[#737685] ${className ?? ""}`.trim()}>
      No image
    </div>
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
  hrefOptions,
  onChange
}: {
  accessToken: string | null;
  tile: HomepageCategoryTileDraft;
  categories: HomepageOptionCategory[];
  hrefOptions: HrefOption[];
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
    <SelectField
      label="Category Route"
      value={tile.slug ? `/categories/${tile.slug}` : ""}
      onChange={(value) =>
        onChange({
          ...tile,
          slug: value.startsWith("/categories/") ? value.replace("/categories/", "") : tile.slug
        })
      }
      options={[
        { value: "", label: "Auto from linked category" },
        ...mergeHrefOptions(hrefOptions, tile.slug ? `/categories/${tile.slug}` : null)
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
  hrefOptions,
  onChange
}: {
  accessToken: string | null;
  item: HomepageBrandSpotlightDraft;
  brands: HomepageOptionBrand[];
  products: HomepageOptionProduct[];
  hrefOptions: HrefOption[];
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
      <SelectField
        label="Brand Route"
        value={item.slug ? `/brands/${item.slug}` : ""}
        onChange={(value) =>
          onChange({
            ...item,
            slug: value.startsWith("/brands/") ? value.replace("/brands/", "") : item.slug
          })
        }
        options={[
          { value: "", label: "Auto from linked brand" },
          ...mergeHrefOptions(hrefOptions, item.slug ? `/brands/${item.slug}` : null)
        ]}
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
  hrefOptions,
  onChange
}: {
  accessToken: string | null;
  item: HomepageCampaignSpotlightDraft;
  campaigns: HomepageOptionCampaign[];
  products: HomepageOptionProduct[];
  hrefOptions: HrefOption[];
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
        label="Campaign Route"
        value={item.slug ? `/campaigns/${item.slug}` : ""}
        onChange={(value) =>
          onChange({
            ...item,
            slug: value.startsWith("/campaigns/") ? value.replace("/campaigns/", "") : item.slug
          })
        }
        options={[
          { value: "", label: "Auto from linked campaign" },
          ...mergeHrefOptions(hrefOptions, item.slug ? `/campaigns/${item.slug}` : null)
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
  hrefOptions,
  onChange
}: {
  accessToken: string | null;
  item: HomepagePromoOfferDraft;
  products: HomepageOptionProduct[];
  hrefOptions: HrefOption[];
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
      <SelectField
        label="CTA Route"
        value={item.ctaHref}
        onChange={(value) => onChange({ ...item, ctaHref: value })}
        options={mergeHrefOptions(hrefOptions, item.ctaHref)}
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
      <p className="mt-1 text-xs text-[#737685]">Use a concise trust marker such as Verified purchase or Repeat customer.</p>
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
