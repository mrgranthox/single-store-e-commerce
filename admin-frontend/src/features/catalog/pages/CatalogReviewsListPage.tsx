import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { StitchGradientButton, StitchSecondaryButton } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  listAdminCatalogReviews,
  moderateAdminCatalogReview,
  type AdminReviewListItem,
  type ReviewModerationStatus
} from "@/features/catalog/api/admin-catalog.api";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

const tone = (s: string): StatusBadgeTone => {
  if (s === "PUBLISHED") {
    return "active";
  }
  if (s === "REJECTED" || s === "HIDDEN") {
    return "danger";
  }
  return "pending";
};

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const moderationStatusLabel = (s: string) => {
  const map: Record<string, string> = {
    PENDING: "Pending",
    PUBLISHED: "Published",
    HIDDEN: "Hidden",
    REJECTED: "Rejected"
  };
  return map[s] ?? s.replace(/_/g, " ");
};

const reviewExcerpt = (body: string | null, max = 96) => {
  const t = body?.trim();
  if (!t) {
    return "No written comment";
  }
  const line = t.split(/\n/)[0] ?? t;
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

const Stars = ({ rating }: { rating: number }) => (
  <span
    className="inline-flex items-center gap-0.5 tabular-nums text-sm"
    aria-label={`${rating} out of 5 stars`}
  >
    {Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? "text-amber-500" : "text-slate-200"} aria-hidden>
        ★
      </span>
    ))}
    <span className="ml-1 text-xs text-slate-500">{rating}/5</span>
  </span>
);

const ReviewModerationDrawer = ({
  review,
  open,
  onClose
}: {
  review: AdminReviewListItem | null;
  open: boolean;
  onClose: () => void;
}) => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const panelRef = useRef<HTMLElement>(null);
  const [moderationNote, setModerationNote] = useState("");

  useEffect(() => {
    if (open && review) {
      setModerationNote("");
    }
  }, [open, review?.id]);

  useEffect(() => {
    if (!open || !review) {
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const prevFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      [...panel.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])"
      )].filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const els = focusables();
        const first = els[0];
        (first ?? panel).focus();
      });
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const els = focusables();
      if (e.key !== "Tab" || els.length === 0) {
        return;
      }
      const firstEl = els[0]!;
      const lastEl = els[els.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    panel.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      panel.removeEventListener("keydown", onKey);
      prevFocused?.focus?.();
    };
  }, [open, onClose, review?.id]);

  const mut = useMutation({
    mutationFn: (status: ReviewModerationStatus) => {
      if (!accessToken || !review) {
        throw new Error("Not signed in.");
      }
      return moderateAdminCatalogReview(accessToken, review.id, {
        status,
        ...(moderationNote.trim() ? { moderationNote: moderationNote.trim() } : {})
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-reviews"] });
      setModerationNote("");
      onClose();
    }
  });

  if (!open || !review) {
    return null;
  }

  const is = (s: string) => review.status === s;
  const productTitle = review.product?.title ?? "Product";
  const authorLine = review.author.name?.trim() || review.author.email || "Customer";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
        role="presentation"
        aria-hidden
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-moderation-title"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="review-moderation-title" className="text-lg font-bold text-slate-900">
              Moderate review
            </h2>
            <p className="mt-1 text-xs text-slate-500">Changes apply immediately and are recorded for audit.</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <section className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 space-y-2 text-sm">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Product</span>
              <div className="mt-1 font-semibold text-slate-900">
                {review.product ? (
                  <Link
                    className="text-[#4f7ef8] hover:underline"
                    to={`/admin/catalog/products/${review.product.id}`}
                    onClick={onClose}
                  >
                    {productTitle}
                  </Link>
                ) : (
                  productTitle
                )}
              </div>
              {review.variant ? (
                <p className="text-xs text-slate-500 mt-0.5">SKU: {review.variant.sku}</p>
              ) : null}
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reviewer</span>
              <p className="mt-1 text-slate-800">{authorLine}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rating</span>
              <Stars rating={review.rating} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current status</span>
              <div className="mt-1">
                <StatusBadge label={moderationStatusLabel(review.status)} tone={tone(review.status)} />
              </div>
            </div>
          </section>

          <section>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Customer comment</span>
            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-100 bg-white p-3 text-sm leading-relaxed text-slate-700">
              {review.body?.trim() ? review.body : "No written comment was provided."}
            </p>
          </section>

          {review.moderationNote ? (
            <section>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Previous staff note</span>
              <p className="mt-2 text-sm text-slate-600">{review.moderationNote}</p>
            </section>
          ) : null}

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Staff note (optional)</span>
            <textarea
              value={moderationNote}
              onChange={(e) => setModerationNote(e.target.value)}
              placeholder="Visible on internal records; customers do not see this."
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
            />
          </label>
        </div>

        <div className="border-t border-slate-100 px-5 py-4 space-y-3 bg-slate-50/50">
          <div className="flex flex-col gap-2">
            <StitchGradientButton
              disabled={mut.isPending || is("PUBLISHED")}
              onClick={() => mut.mutate("PUBLISHED")}
            >
              Publish
            </StitchGradientButton>
            <div className="grid grid-cols-2 gap-2">
              <StitchSecondaryButton disabled={mut.isPending || is("HIDDEN")} onClick={() => mut.mutate("HIDDEN")}>
                Hide
              </StitchSecondaryButton>
              <StitchSecondaryButton
                disabled={mut.isPending || is("REJECTED")}
                onClick={() => mut.mutate("REJECTED")}
                className="border-rose-200 text-rose-800 hover:bg-rose-50"
              >
                Reject
              </StitchSecondaryButton>
            </div>
          </div>
          {mut.isError ? (
            <p className="text-xs text-red-600" role="alert">
              {mut.error instanceof ApiError ? mut.error.message : "Moderation failed."}
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
};

export const CatalogReviewsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [drawerReview, setDrawerReview] = useState<AdminReviewListItem | null>(null);

  const queryKey = useMemo(
    () => ["admin-catalog-reviews", page, status, appliedSearch] as const,
    [page, status, appliedSearch]
  );

  const q = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminCatalogReviews(accessToken, {
        page,
        page_size: 20,
        ...(status ? { status } : {}),
        ...(appliedSearch.trim() ? { q: appliedSearch.trim() } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = q.data?.data.items ?? [];
  const meta = q.data?.meta;
  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const applyFilters = () => {
    setPage(1);
    setAppliedSearch(searchDraft);
  };

  const clearFilters = () => {
    setSearchDraft("");
    setAppliedSearch("");
    setStatus("");
    setPage(1);
  };

  const rows = items.map((r) => {
    const productTitle = r.product?.title ?? "Unknown product";
    const authorLine = r.author.name?.trim() || r.author.email || "—";
    return [
      <span key={`ex-${r.id}`} className="max-w-[220px] text-sm text-slate-700" title={reviewExcerpt(r.body, 200)}>
        {reviewExcerpt(r.body)}
      </span>,
      <Stars key={`rt-${r.id}`} rating={r.rating} />,
      <div key={`p-${r.id}`} className="min-w-0">
        {r.product ? (
          <Link
            className="font-medium text-[#4f7ef8] hover:underline line-clamp-2"
            to={`/admin/catalog/products/${r.product.id}`}
          >
            {productTitle}
          </Link>
        ) : (
          <span className="text-slate-500">{productTitle}</span>
        )}
        {r.variant ? <p className="text-xs text-slate-500">SKU {r.variant.sku}</p> : null}
      </div>,
      <span key={`a-${r.id}`} className="max-w-[160px] truncate text-sm text-slate-600" title={authorLine}>
        {authorLine}
      </span>,
      <StatusBadge key={`st-${r.id}`} label={moderationStatusLabel(r.status)} tone={tone(r.status)} />,
      <span key={`u-${r.id}`} className="text-sm text-slate-500">
        {formatDate(r.createdAt)}
      </span>,
      <button
        key={`act-${r.id}`}
        type="button"
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-800 hover:bg-slate-50"
        onClick={() => setDrawerReview(r)}
      >
        Moderate
      </button>
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description="Read shopper feedback, open a review to moderate, and keep product pages trustworthy."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-catalog-reviews"])]}
      />

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Search</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                strokeWidth={2}
                aria-hidden
              />
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applyFilters();
                  }
                }}
                placeholder="Product title, customer email, or SKU"
                className="h-11 w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
              />
            </div>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Status</span>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PUBLISHED">Published</option>
              <option value="HIDDEN">Hidden</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-semibold text-[#4f7ef8] hover:underline"
          >
            Clear filters
          </button>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <>
          <DataTableShell
            columns={["Preview", "Rating", "Product", "Reviewer", "Status", "Submitted", ""]}
            rows={rows}
            rowKeys={items.map((r) => r.id)}
            emptyState="No reviews match your filters."
          />
          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
              <button
                type="button"
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="text-slate-500">
                Page {meta.page} of {meta.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= meta.totalPages}
                className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}

      <ReviewModerationDrawer
        review={drawerReview}
        open={drawerReview != null}
        onClose={() => setDrawerReview(null)}
      />
    </div>
  );
};
