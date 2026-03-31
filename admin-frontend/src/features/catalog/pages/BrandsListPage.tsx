import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import clsx from "clsx";

import { DataTableShell } from "@/components/primitives/DataTableShell";
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
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [rowErr, setRowErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-catalog-brands"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminCatalogBrands(accessToken);
    },
    enabled: Boolean(accessToken)
  });

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

  const items = q.data?.data.items ?? [];
  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const kpi = useMemo(() => {
    const total = items.length;
    const active = items.filter((b) => b.status === "ACTIVE").length;
    const archived = items.filter((b) => b.status === "ARCHIVED").length;
    return { total, active, archived };
  }, [items]);

  const filtered = useMemo(() => {
    const needle = appliedSearch.trim().toLowerCase();
    return items.filter((b: AdminBrandRow) => {
      if (statusFilter && b.status !== statusFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return b.name.toLowerCase().includes(needle) || b.slug.toLowerCase().includes(needle);
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

  const onArchive = (b: AdminBrandRow) => {
    if (
      !window.confirm(
        `Archive brand "${b.name}"? You can restore it later from the list when showing archived statuses.`
      )
    ) {
      return;
    }
    archiveMut.mutate(b.id);
  };

  const onRestore = (b: AdminBrandRow) => {
    restoreMut.mutate(b.id);
  };

  const rows = filtered.map((b) => [
    <div key={b.id} className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-600">
        {initialsFromName(b.name)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#181b25]">{b.name}</p>
        <p className="text-[11px] text-slate-400">—</p>
      </div>
    </div>,
    <span
      key={`s-${b.id}`}
      className="inline-block rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-500"
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
            onClick={() => void q.refetch()}
          >
            <RefreshCw className={clsx("h-4 w-4", q.isFetching && "animate-spin")} />
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
          columns={["Brand identity", "Internal slug", "Volume", "Status", "Operations"]}
          rows={rows}
          rowKeys={filtered.map((b) => b.id)}
          emptyState={items.length === 0 ? "No brands yet." : "No brands match your filters."}
        />
      )}
    </StitchPageBody>
  );
};
