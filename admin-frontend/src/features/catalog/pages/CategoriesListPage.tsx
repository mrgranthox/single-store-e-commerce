import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import clsx from "clsx";

import { DataTableShell } from "@/components/primitives/DataTableShell";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  CatalogWorkspaceNav,
  StitchBreadcrumbs,
  StitchFieldLabel,
  StitchFilterPanel,
  StitchPageBody
} from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  archiveAdminCatalogCategory,
  listAdminCatalogCategories,
  restoreAdminCatalogCategory,
  type AdminCategoryRow
} from "@/features/catalog/api/admin-catalog.api";

const categoryStatusPill = (status: string) => {
  const s = status.toUpperCase();
  if (s === "ACTIVE") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  if (s === "ARCHIVED") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
        Archived
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-400">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
      Draft
    </span>
  );
};

export const CategoriesListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [rowErr, setRowErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-catalog-categories"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminCatalogCategories(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const archiveMut = useMutation({
    mutationFn: async (categoryId: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return archiveAdminCatalogCategory(accessToken, categoryId, {});
    },
    onSuccess: async () => {
      setRowErr(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-categories"] });
    },
    onError: (e) => {
      setRowErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Archive failed.");
    }
  });

  const restoreMut = useMutation({
    mutationFn: async (categoryId: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return restoreAdminCatalogCategory(accessToken, categoryId);
    },
    onSuccess: async () => {
      setRowErr(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-categories"] });
    },
    onError: (e) => {
      setRowErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Restore failed.");
    }
  });

  const items = q.data?.data.items ?? [];
  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const filtered = useMemo(() => {
    const needle = appliedSearch.trim().toLowerCase();
    return items.filter((c: AdminCategoryRow) => {
      if (statusFilter && c.status !== statusFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return c.name.toLowerCase().includes(needle) || c.slug.toLowerCase().includes(needle);
    });
  }, [items, appliedSearch, statusFilter]);

  const applyFilters = () => {
    setAppliedSearch(searchDraft);
  };

  const clearFilters = () => {
    setSearchDraft("");
    setAppliedSearch("");
    setStatusFilter("");
  };

  const onArchive = (c: AdminCategoryRow) => {
    if (
      !window.confirm(
        `Archive category "${c.name}"? You can restore it later from the list when showing archived statuses.`
      )
    ) {
      return;
    }
    archiveMut.mutate(c.id);
  };

  const onRestore = (c: AdminCategoryRow) => {
    restoreMut.mutate(c.id);
  };

  const rows = filtered.map((c) => [
    <div key={c.id} className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100">
        <MaterialIcon name="category" className="text-sm text-slate-400" />
      </div>
      <span className="text-sm font-semibold text-[#181b25]">{c.name}</span>
    </div>,
    <span key={`s-${c.id}`} className="font-mono text-xs text-slate-500">
      {c.slug}
    </span>,
    <span key={`p-${c.id}`} className="text-xs italic text-slate-400">
      None (Root)
    </span>,
    <span
      key={`n-${c.id}`}
      className="inline-block rounded bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600"
    >
      {c.productCount.toLocaleString()}
    </span>,
    <div key={`st-${c.id}`} className="flex justify-center">
      {categoryStatusPill(c.status)}
    </div>,
    <div key={`a-${c.id}`} className="text-right">
      <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <Link
          to={`/admin/catalog/categories/${c.id}/edit`}
          className="rounded-lg border border-transparent p-2 text-[#1653cc] transition-all hover:border-slate-100 hover:bg-white"
          aria-label={`Edit ${c.name}`}
        >
          <MaterialIcon name="edit" className="text-lg" />
        </Link>
        {c.status === "ARCHIVED" ? (
          <button
            type="button"
            className="rounded-lg border border-transparent p-2 text-[#1653cc] transition-all hover:border-slate-100 hover:bg-white disabled:opacity-50"
            aria-label={`Restore ${c.name}`}
            disabled={restoreMut.isPending}
            onClick={() => onRestore(c)}
          >
            <MaterialIcon name="restore_from_trash" className="text-lg" />
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-transparent p-2 text-[#ba1a1a] transition-all hover:border-slate-100 hover:bg-white disabled:opacity-50"
            aria-label={`Archive ${c.name}`}
            disabled={archiveMut.isPending}
            onClick={() => onArchive(c)}
          >
            <MaterialIcon name="archive" className="text-lg" />
          </button>
        )}
      </div>
    </div>
  ]);

  return (
    <StitchPageBody>
      <CatalogWorkspaceNav />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <StitchBreadcrumbs
            items={[
              { label: "Catalog", to: "/admin/catalog/products" },
              { label: "Categories" }
            ]}
          />
          <h2 className="font-headline text-3xl font-bold tracking-tight text-[#181b25]">Categories</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-1 flex rounded-lg bg-[#ecedfb] p-1">
            <span className="flex items-center gap-2 rounded-md bg-white px-4 py-1.5 text-xs font-bold text-[#1653cc] shadow-sm">
              <MaterialIcon name="list" className="text-sm" />
              List view
            </span>
            <button
              type="button"
              disabled
              className="flex cursor-not-allowed items-center gap-2 rounded-md px-4 py-1.5 text-xs font-bold text-slate-400 opacity-60"
              aria-disabled
            >
              <MaterialIcon name="account_tree" className="text-sm" />
              Tree view
            </button>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
            aria-label="Refresh categories"
            onClick={() => void q.refetch()}
          >
            <RefreshCw className={clsx("h-4 w-4", q.isFetching && "animate-spin")} />
          </button>
          <Link
            to="/admin/catalog/categories/new"
            className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#1653cc]/20 transition-opacity hover:opacity-90"
          >
            <MaterialIcon name="add" className="text-sm text-white" />
            Create category
          </Link>
        </div>
      </div>

      <StitchFilterPanel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="md:col-span-2">
            <StitchFieldLabel>Search</StitchFieldLabel>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737685]"
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
                placeholder="Category name or URL slug"
                className="w-full rounded-lg border-0 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-[#181b25] placeholder:text-[#737685]/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1653cc]/20"
              />
            </div>
          </label>
          <label>
            <StitchFieldLabel>Status</StitchFieldLabel>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 w-full rounded-lg border-0 bg-[#f2f3ff] px-3 text-xs text-[#181b25] focus:outline-none focus:ring-2 focus:ring-[#1653cc]/25"
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-[#181b25] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#0f1117]"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-semibold text-[#1653cc] hover:underline"
          >
            Clear filters
          </button>
        </div>
      </StitchFilterPanel>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}
      {rowErr ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {rowErr}
        </div>
      ) : null}
      {q.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <DataTableShell
          variant="stitchOperational"
          columns={["Name", "Slug", "Parent category", "Products", "Status", "Actions"]}
          rows={rows}
          rowKeys={filtered.map((c) => c.id)}
          emptyState={items.length === 0 ? "No categories yet." : "No categories match your filters."}
        />
      )}
    </StitchPageBody>
  );
};
