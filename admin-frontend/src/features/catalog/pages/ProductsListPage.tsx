import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, MoreHorizontal, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/primitives/PageHeader";
import { StitchOperationalTableSkeleton } from "@/components/primitives/StitchOperationalTableSkeleton";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  archiveAdminCatalogProduct,
  listAdminCatalogBrands,
  listAdminCatalogCategories,
  listAdminCatalogProducts,
  publishAdminCatalogProduct,
  unpublishAdminCatalogProduct,
  type AdminProductListItem
} from "@/features/catalog/api/admin-catalog.api";
import { formatProductListPrice } from "@/features/catalog/lib/format-money";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PUBLISHED", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" }
];

const statusTone = (status: string): StatusBadgeTone => {
  switch (status) {
    case "PUBLISHED":
      return "active";
    case "DRAFT":
      return "draft";
    case "ARCHIVED":
      return "danger";
    default:
      return "draft";
  }
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

const BulkDeleteDisabled = () => (
  <span className="group/del relative inline-flex rounded-md outline-none ring-offset-2 focus-within:ring-2 focus-within:ring-[#4f7ef8]" tabIndex={0}>
    <button
      type="button"
      disabled
      className="cursor-not-allowed rounded-md border border-red-200 bg-white px-3 py-1.5 font-medium text-red-700 opacity-55"
      aria-describedby="bulk-delete-hint"
    >
      Delete
    </button>
    <span
      id="bulk-delete-hint"
      role="tooltip"
      className="pointer-events-none invisible absolute bottom-full left-1/2 z-40 mb-2 w-max max-w-[240px] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-left text-[11px] leading-snug text-white opacity-0 shadow-lg transition group-hover/del:visible group-hover/del:opacity-100 group-focus-within/del:visible group-focus-within/del:opacity-100"
    >
      Bulk product delete is not available in the API. Use Archive, or clear inventory from the Inventory tab.
    </span>
  </span>
);

const Thumb = ({ url, title }: { url: string | null; title: string }) => {
  if (!url) {
    return (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-medium text-slate-400"
        aria-hidden
      >
        —
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-10 w-10 shrink-0 rounded object-cover"
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
};

const RowActions = ({
  product,
  onArchive
}: {
  product: AdminProductListItem;
  onArchive: (id: string) => void;
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => setOpen(false);
    const t = window.setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", close);
    };
  }, [open]);

  return (
    <div className="relative text-right">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
        aria-label="Row actions"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <Link
            to={`/admin/catalog/products/${product.id}/edit`}
            className="block px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Edit
          </Link>
          <Link
            to={`/admin/catalog/products/${product.id}`}
            className="block px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            View
          </Link>
          <Link
            to={`/admin/catalog/products/${product.id}/analytics`}
            className="block px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Analytics
          </Link>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              onArchive(product.id);
            }}
          >
            Archive
          </button>
        </div>
      ) : null}
    </div>
  );
};

export const ProductsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryId, setCategoryId] = useState(() => searchParams.get("categoryId") ?? "");
  const [brandId, setBrandId] = useState(() => searchParams.get("brandId") ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pinnedExpandId, setPinnedExpandId] = useState<string | null>(null);

  useEffect(() => {
    const c = searchParams.get("categoryId") ?? "";
    const b = searchParams.get("brandId") ?? "";
    setCategoryId((prev) => (prev === c ? prev : c));
    setBrandId((prev) => (prev === b ? prev : b));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const curCat = params.get("categoryId") ?? "";
    const curBrand = params.get("brandId") ?? "";
    if (curCat === categoryId && curBrand === brandId) {
      return;
    }
    const next = new URLSearchParams(params);
    if (categoryId) {
      next.set("categoryId", categoryId);
    } else {
      next.delete("categoryId");
    }
    if (brandId) {
      next.set("brandId", brandId);
    } else {
      next.delete("brandId");
    }
    setSearchParams(next, { replace: true });
  }, [brandId, categoryId, setSearchParams]);

  const categoriesQuery = useQuery({
    queryKey: ["admin-catalog-categories-options"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminCatalogCategories(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const brandsQuery = useQuery({
    queryKey: ["admin-catalog-brands-options"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminCatalogBrands(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const categories = categoriesQuery.data?.data.items ?? [];
  const brands = brandsQuery.data?.data.items ?? [];

  const queryKey = useMemo(
    () =>
      [
        "admin-catalog-products",
        page,
        appliedSearch,
        statusFilter,
        categoryId,
        brandId,
        dateFrom,
        dateTo
      ] as const,
    [page, appliedSearch, statusFilter, categoryId, brandId, dateFrom, dateTo]
  );

  const productsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminCatalogProducts(accessToken, {
        page,
        page_size: 25,
        sortBy: "updatedAt",
        sortOrder: "desc",
        ...(appliedSearch.trim() ? { q: appliedSearch.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(brandId ? { brandId } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {})
      });
    },
    enabled: Boolean(accessToken)
  });

  const items = productsQuery.data?.data.items ?? [];
  const meta = productsQuery.data?.meta;

  useEffect(() => {
    if (items.length === 0) {
      setPinnedExpandId(null);
      return;
    }
    setPinnedExpandId((prev) =>
      prev != null && items.some((p) => p.id === prev) ? prev : items[0]!.id
    );
  }, [items]);

  const applyFilters = () => {
    setPage(1);
    setAppliedSearch(searchDraft);
    setSelected(new Set());
  };

  const clearFilters = () => {
    setSearchDraft("");
    setAppliedSearch("");
    setStatusFilter("");
    setCategoryId("");
    setBrandId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    setSelected(new Set());
  };

  const errorMessage =
    productsQuery.error instanceof ApiError
      ? productsQuery.error.message
      : productsQuery.error instanceof Error
        ? productsQuery.error.message
        : null;

  const allOnPageSelected = items.length > 0 && items.every((p) => selected.has(p.id));
  const someOnPageSelected = items.some((p) => selected.has(p.id));

  const toggleAllPage = () => {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        items.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        items.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const runBulk = useCallback(
    async (action: "publish" | "unpublish" | "archive") => {
      if (!accessToken || selected.size === 0) {
        return;
      }
      setBulkBusy(true);
      setBulkMessage(null);
      const ids = [...selected];
      const fn =
        action === "publish"
          ? publishAdminCatalogProduct
          : action === "unpublish"
            ? unpublishAdminCatalogProduct
            : archiveAdminCatalogProduct;
      const results = await Promise.allSettled(ids.map((id) => fn(accessToken, id, {})));
      const failed = results.filter((r) => r.status === "rejected").length;
      setBulkBusy(false);
      setBulkMessage(
        failed
          ? `${ids.length - failed} updated, ${failed} failed (check permissions or product state).`
          : `${ids.length} product(s) updated.`
      );
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-products"] });
    },
    [accessToken, queryClient, selected]
  );

  const confirmArchiveOne = useCallback(
    async (id: string) => {
      if (!accessToken) {
        return;
      }
      setActionError(null);
      if (!window.confirm("Archive this product? Archived products cannot be republished from the list.")) {
        return;
      }
      try {
        await archiveAdminCatalogProduct(accessToken, id, {});
        await queryClient.invalidateQueries({ queryKey: ["admin-catalog-products"] });
      } catch (e) {
        setActionError(e instanceof ApiError ? e.message : "Archive failed.");
      }
    },
    [accessToken, queryClient]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Search, filter, and manage catalog products, pricing signals, and stock at a glance."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-catalog-products"])]}
        actions={
          <Link
            to="/admin/catalog/products/new"
            className="flex items-center gap-2 rounded-lg bg-[#4f7ef8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98]"
          >
            <MaterialIcon name="add" className="text-lg text-white" />
            Create product
          </Link>
        }
      />

      <div className="rounded-xl bg-white p-4 shadow-sm">
        {actionError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
                placeholder="Name or SKU"
                className="h-11 w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
              />
            </div>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
                setSelected(new Set());
              }}
              className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value || "all"} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Category</span>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
                setSelected(new Set());
              }}
              className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Brand</span>
            <select
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setPage(1);
                setSelected(new Set());
              }}
              className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1.5 block text-xs font-medium text-slate-400">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                  setSelected(new Set());
                }}
                className="h-11 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium text-slate-400">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                  setSelected(new Set());
                }}
                className="h-11 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
              />
            </label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Apply filters
          </button>
          <button type="button" onClick={clearFilters} className="text-sm font-semibold text-[#4f7ef8] hover:underline">
            Clear filters
          </button>
        </div>
      </div>

      {bulkMessage ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">{bulkMessage}</div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMessage}
          {productsQuery.error instanceof ApiError && productsQuery.error.statusCode === 403 ? (
            <span className="mt-1 block text-xs">Your role may need the catalog.products.read permission.</span>
          ) : null}
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-[#e8edfc] px-4 py-3 text-sm">
          <span className="font-semibold text-slate-800">{selected.size} selected</span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => runBulk("publish")}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Publish
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => runBulk("unpublish")}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Unpublish
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => runBulk("archive")}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Archive
          </button>
          <BulkDeleteDisabled />
        </div>
      ) : null}

      {productsQuery.isLoading ? (
        <StitchOperationalTableSkeleton rowCount={10} columnCount={7} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = someOnPageSelected && !allOnPageSelected;
                        }
                      }}
                      onChange={toggleAllPage}
                      aria-label="Select all on page"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Product
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Category
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Brand
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Price
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Stock
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Visibility
                  </th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                      No products match the current filters.
                    </td>
                  </tr>
                ) : (
                  items.map((product) => (
                    <Fragment key={product.id}>
                    <tr className="group transition-colors hover:bg-[#e6e7f6]/80">
                      <td className="px-3 py-2 align-middle">
                        <input
                          type="checkbox"
                          checked={selected.has(product.id)}
                          onChange={() => toggleOne(product.id)}
                          aria-label={`Select ${product.title}`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className="mt-1 shrink-0 text-slate-400 hover:text-slate-700"
                            aria-expanded={pinnedExpandId === product.id}
                            aria-label={pinnedExpandId === product.id ? "Collapse row details" : "Expand row details"}
                            onClick={() =>
                              setPinnedExpandId((id) => (id === product.id ? null : product.id))
                            }
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${pinnedExpandId === product.id ? "rotate-180" : ""}`}
                              strokeWidth={2}
                            />
                          </button>
                          <Thumb url={product.thumbnailUrl} title={product.title} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                to={`/admin/catalog/products/${product.id}`}
                                className="font-semibold text-[#4f7ef8] hover:underline"
                              >
                                {product.title}
                              </Link>
                              <span className="hidden opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex sm:gap-1">
                                <Link
                                  to={`/admin/catalog/products/${product.id}/edit`}
                                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Edit
                                </Link>
                                <Link
                                  to={`/admin/catalog/products/${product.id}/analytics`}
                                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Analytics
                                </Link>
                              </span>
                            </div>
                            <p className="mt-0.5 font-mono text-xs text-slate-500">
                              {product.primarySku ?? "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[160px] px-3 py-2 align-middle text-sm text-slate-700">
                        {product.categoryLabels.length ? product.categoryLabels.join(", ") : "—"}
                      </td>
                      <td className="px-3 py-2 align-middle text-sm text-slate-700">
                        {product.brand?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle text-sm text-slate-800">
                        {formatProductListPrice(product.pricing)}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="font-mono text-sm">{product.inventorySummary.available.toLocaleString()}</div>
                        {product.inventorySummary.lowStock ? (
                          <StatusBadge label="Low" tone="pending" />
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <StatusBadge label={product.status.replace(/_/g, " ")} tone={statusTone(product.status)} />
                      </td>
                      <td className="px-3 py-2 align-middle text-sm text-slate-600">{product.visibility}</td>
                      <td className="px-3 py-2 align-middle">
                        <RowActions product={product} onArchive={confirmArchiveOne} />
                      </td>
                    </tr>
                    {pinnedExpandId === product.id ? (
                      <tr className="bg-[#eef1fb]">
                        <td colSpan={9} className="border-t border-slate-200 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-700">
                            <span>
                              <span className="font-semibold text-slate-500">Slug</span>{" "}
                              <span className="font-mono text-xs">{product.slug}</span>
                            </span>
                            <span>
                              <span className="font-semibold text-slate-500">Updated</span> {formatDate(product.updatedAt)}
                            </span>
                            <span>
                              <span className="font-semibold text-slate-500">Visibility</span> {product.visibility}
                            </span>
                            <Link
                              to={`/admin/catalog/products/${product.id}/edit`}
                              className="font-semibold text-[#4f7ef8] hover:underline"
                            >
                              Quick edit
                            </Link>
                            <Link
                              to={`/admin/catalog/products/${product.id}/variants`}
                              className="font-semibold text-[#4f7ef8] hover:underline"
                            >
                              Variants
                            </Link>
                            <Link
                              to={`/admin/catalog/products/${product.id}/media`}
                              className="font-semibold text-[#4f7ef8] hover:underline"
                            >
                              Media
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.totalItems} products
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
