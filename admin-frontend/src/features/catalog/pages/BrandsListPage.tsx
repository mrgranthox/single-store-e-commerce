import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";
import { RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import clsx from "clsx";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { QueryError } from "@/components/primitives/QueryError";
import { SkeletonTable } from "@/components/primitives/Skeleton";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  CatalogWorkspaceNav,
  StitchFieldLabel,
  StitchFilterPanel,
  StitchKpiMicro,
  StitchPageBody
} from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  archiveAdminCatalogBrand,
  listAdminCatalogBrands,
  restoreAdminCatalogBrand,
  type AdminBrandRow
} from "@/features/catalog/api/admin-catalog.api";
import { useListFilters } from "@/lib/hooks/useListFilters";

const BRAND_LIST_DEFAULTS = { q: "", status: "" };

const statusLabel = (s: string) => {
  if (s === "ACTIVE") {
    return "Active";
  }
  if (s === "ARCHIVED") {
    return "Archived";
  }
  if (s === "DRAFT") {
    return "Draft";
  }
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const initialsFromName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "—";
};

const brandStatusCell = (status: string) => {
  const dot =
    status === "ACTIVE"
      ? "bg-[#006b2d]"
      : status === "ARCHIVED"
        ? "bg-[#737685]"
        : "bg-amber-500";
  const textCls = status === "ARCHIVED" ? "text-slate-500" : "text-[#181b25]";
  return (
    <div className="flex items-center gap-2">
      <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      <span className={clsx("text-xs font-medium", textCls)}>{statusLabel(status)}</span>
    </div>
  );
};

export const BrandsListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const { filters, set, setMany, reset } = useListFilters({ defaults: BRAND_LIST_DEFAULTS });
  const [searchDraft, setSearchDraft] = useState("");
  const [rowErr, setRowErr] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  const brandsQuery = useAuthedQuery(["admin-catalog-brands"], (token) => listAdminCatalogBrands(token));

  const archiveMut = useMutation({
    mutationFn: async (brandId: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return archiveAdminCatalogBrand(accessToken, brandId, {});
    },
    onSuccess: async () => {
      setRowErr(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-brands"] });
    },
    onError: (e) => {
      setRowErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Archive failed.");
    }
  });

  const restoreMut = useMutation({
    mutationFn: async (brandId: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return restoreAdminCatalogBrand(accessToken, brandId);
    },
    onSuccess: async () => {
      setRowErr(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-brands"] });
    },
    onError: (e) => {
      setRowErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Restore failed.");
    }
  });

  const items = brandsQuery.data?.data.items ?? [];

  const kpi = useMemo(() => {
    const total = items.length;
    const active = items.filter((b) => b.status === "ACTIVE").length;
    const archived = items.filter((b) => b.status === "ARCHIVED").length;
    return { total, active, archived };
  }, [items]);

  const filtered = useMemo(() => {
    const needle = filters.q.trim().toLowerCase();
    return items.filter((b: AdminBrandRow) => {
      if (filters.status && b.status !== filters.status) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return b.name.toLowerCase().includes(needle) || b.slug.toLowerCase().includes(needle);
    });
  }, [items, filters.q, filters.status]);

  const applyFilters = () => {
    setMany({ q: searchDraft.trim() });
  };

  const clearFilters = () => {
    reset();
    setSearchDraft("");
  };

  const onArchive = (b: AdminBrandRow) => {
    setPendingArchive({ id: b.id, name: b.name });
  };

  const onRestore = (b: AdminBrandRow) => {
    restoreMut.mutate(b.id);
  };

  const rows = filtered.map((b) => [
    <div key={b.id} className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-600">
        {b.logoUrl ? (
          <img src={b.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsFromName(b.name)
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#181b25]">{b.name}</p>
        <p className="text-xs text-slate-400">—</p>
      </div>
    </div>,
    <span
      key={`s-${b.id}`}
      className="inline-block rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-500"
    >
      {b.slug}
    </span>,
    <p key={`v-${b.id}`} className="font-mono text-sm text-[#181b25]">
      {b.productCount.toLocaleString()}
    </p>,
    <div key={`st-${b.id}`}>{brandStatusCell(b.status)}</div>,
    <div key={`a-${b.id}`} className="text-right">
      <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <Link
          to={`/admin/catalog/brands/${b.id}/edit`}
          className="rounded p-1.5 text-slate-400 transition-colors hover:text-[#1653cc]"
          aria-label={`Edit ${b.name}`}
        >
          <MaterialIcon name="edit" className="text-lg" />
        </Link>
        {b.status === "ARCHIVED" ? (
          <button
            type="button"
            className="rounded p-1.5 text-slate-400 transition-colors hover:text-[#1653cc] disabled:opacity-50"
            aria-label={`Restore ${b.name}`}
            disabled={restoreMut.isPending}
            onClick={() => onRestore(b)}
          >
            <MaterialIcon name="restore_from_trash" className="text-lg" />
          </button>
        ) : (
          <button
            type="button"
            className="rounded p-1.5 text-slate-400 transition-colors hover:text-[#ba1a1a] disabled:opacity-50"
            aria-label={`Archive ${b.name}`}
            disabled={archiveMut.isPending}
            onClick={() => onArchive(b)}
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
          <h2 className="font-headline text-2xl font-bold tracking-tight text-[#0f1117]">Brands</h2>
          <p className="mt-1 text-sm text-[#5b5e68]">
            Manage global brand identity and product distribution across the registry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
            aria-label="Refresh brands"
            onClick={() => void brandsQuery.refetch()}
          >
            <RefreshCw className={clsx("h-4 w-4", brandsQuery.isFetching && "animate-spin")} />
          </button>
          <Link
            to="/admin/catalog/brands/new"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <MaterialIcon name="add" className="text-lg text-white" />
            Add Brand
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StitchKpiMicro label="Total brands" value={kpi.total.toLocaleString()} barClass="bg-[#1653cc]" />
        <StitchKpiMicro label="Active assets" value={kpi.active.toLocaleString()} barClass="bg-[#006b2d]" />
        <StitchKpiMicro
          label="Archived"
          value={<span className="font-mono">{kpi.archived.toLocaleString()}</span>}
          barClass="bg-[#737685]"
        />
        <StitchKpiMicro
          label="Monthly growth"
          value="—"
          footer={<span className="font-bold text-[#006b2d]">↑</span>}
          barClass="bg-[#3b6de6]"
        />
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
                placeholder="Brand name or URL slug"
                className={clsx(
                  "rounded-lg border-0 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-[#181b25] placeholder:text-[#737685]/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1653cc]/20",
                  "w-full"
                )}
              />
            </div>
          </label>
          <label>
            <StitchFieldLabel>Status</StitchFieldLabel>
            <select
              value={filters.status}
              onChange={(e) => set("status", e.target.value)}
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

      {brandsQuery.isError ? (
        <QueryError label="brands" error={brandsQuery.error} onRetry={() => void brandsQuery.refetch()} />
      ) : null}
      {rowErr ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {rowErr}
        </div>
      ) : null}
      {brandsQuery.isLoading ? (
        <SkeletonTable rows={8} cols={5} label="Loading brands" />
      ) : (
        <DataTableShell
          variant="stitchOperational"
          columns={["Brand identity", "Internal slug", "Volume", "Status", "Operations"]}
          rows={rows}
          rowKeys={filtered.map((b) => b.id)}
          emptyState={items.length === 0 ? "No brands yet." : "No brands match your filters."}
        />
      )}
      <ConfirmDialog
        open={pendingArchive !== null}
        title={`Archive brand "${pendingArchive?.name}"?`}
        body="The brand will be hidden from merchandising flows. You can restore it later by filtering by archived status."
        confirmLabel="Archive brand"
        danger
        onClose={() => setPendingArchive(null)}
        onConfirm={() => {
          if (pendingArchive) archiveMut.mutate(pendingArchive.id);
          setPendingArchive(null);
        }}
      />
    </StitchPageBody>
  );
};
