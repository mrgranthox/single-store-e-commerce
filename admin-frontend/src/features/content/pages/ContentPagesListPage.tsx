import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { PageHeader } from "@/components/primitives/PageHeader";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  archiveAdminContentPage,
  deleteAdminContentPagePermanent,
  listAdminContentPages,
  publishAdminContentPage,
  restoreAdminContentPage,
  unpublishAdminContentPage,
  type ContentPageListItem
} from "@/features/content/api/admin-content.api";
import { CmsPageFormPanel } from "@/features/content/pages/CmsPageFormPanel";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { ContentWorkspaceNav, StitchPageBody } from "@/components/stitch";

const tone = (s: string): StatusBadgeTone => {
  if (s === "PUBLISHED") {
    return "active";
  }
  if (s === "DRAFT") {
    return "draft";
  }
  if (s === "ARCHIVED") {
    return "danger";
  }
  return "pending";
};

const formatUpdated = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const PublishedPill = ({ status }: { status: string }) => {
  if (status === "PUBLISHED") {
    return (
      <span className="inline-flex items-center rounded-full border border-[#006b2d]/30 px-2.5 py-0.5 text-xs font-medium text-[#006b2d]">
        <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#006b2d]" />
        Published
      </span>
    );
  }
  if (status === "ARCHIVED") {
    return (
      <span className="inline-flex items-center rounded-full border border-[#ba1a1a]/30 px-2.5 py-0.5 text-xs font-medium text-[#ba1a1a]">
        <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ba1a1a]" />
        Archived
      </span>
    );
  }
  return <StatusBadge label={status.replace(/_/g, " ")} tone={tone(status)} />;
};

export const ContentPagesListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [panel, setPanel] = useState<"closed" | "create" | "edit" | "view">("closed");
  const [panelPage, setPanelPage] = useState<ContentPageListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentPageListItem | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-content-pages"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminContentPages(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const items = q.data?.data.items ?? [];
  const filtered = useMemo(() => {
    if (!statusFilter) {
      return items;
    }
    return items.filter((p) => p.status === statusFilter);
  }, [items, statusFilter]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-content-pages"] });
  };

  const publishMut = useMutation({
    mutationFn: (id: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return publishAdminContentPage(accessToken, id);
    },
    onSuccess: invalidate
  });
  const unpublishMut = useMutation({
    mutationFn: (id: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return unpublishAdminContentPage(accessToken, id);
    },
    onSuccess: invalidate
  });
  const archiveMut = useMutation({
    mutationFn: (id: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return archiveAdminContentPage(accessToken, id);
    },
    onSuccess: invalidate
  });
  const restoreMut = useMutation({
    mutationFn: (id: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return restoreAdminContentPage(accessToken, id);
    },
    onSuccess: invalidate
  });

  const deletePermMut = useMutation({
    mutationFn: (id: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return deleteAdminContentPagePermanent(accessToken, id);
    },
    onSuccess: () => {
      setDeleteTarget(null);
      setDeleteErr(null);
      invalidate();
    },
    onError: (e) => {
      setDeleteErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Delete failed.");
    }
  });

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const rows = filtered.map((p) => [
    <button
      key={`t-${p.id}`}
      type="button"
      onClick={() => {
        setPanelPage(p);
        setPanel("view");
      }}
      className="text-left font-semibold text-[#181b25] hover:text-[#1653cc]"
    >
      {p.title ?? "(Untitled)"}
    </button>,
    <span key={`s-${p.id}`} className="font-mono text-xs text-slate-500">
      /{p.slug.replace(/^\//, "")}
    </span>,
    <span key={`u-${p.id}`} className="text-sm text-slate-500">
      {formatUpdated(p.updatedAt)}
    </span>,
    <span key={`st-${p.id}`}>
      <PublishedPill status={p.status} />
    </span>,
    <div key={`a-${p.id}`} className="flex flex-wrap justify-end gap-1">
      <button
        type="button"
        title="View"
        onClick={() => {
          setPanelPage(p);
          setPanel("view");
        }}
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#1653cc]/5 hover:text-[#1653cc]"
      >
        <MaterialIcon name="visibility" className="text-lg" />
      </button>
      <button
        type="button"
        title="Edit"
        onClick={() => {
          setPanelPage(p);
          setPanel("edit");
        }}
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#1653cc]/5 hover:text-[#1653cc]"
      >
        <MaterialIcon name="edit_note" className="text-lg" />
      </button>
      {p.status !== "PUBLISHED" ? (
        <button
          type="button"
          title="Publish"
          disabled={publishMut.isPending}
          onClick={() => publishMut.mutate(p.id)}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#006b2d]/10 hover:text-[#006b2d] disabled:opacity-50"
        >
          <MaterialIcon name="publish" className="text-lg" />
        </button>
      ) : (
        <button
          type="button"
          title="Unpublish"
          disabled={unpublishMut.isPending}
          onClick={() => unpublishMut.mutate(p.id)}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50"
        >
          <MaterialIcon name="unpublished" className="text-lg" />
        </button>
      )}
      {p.status !== "ARCHIVED" ? (
        <button
          type="button"
          title="Archive"
          disabled={archiveMut.isPending}
          onClick={() => archiveMut.mutate(p.id)}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#434654] disabled:opacity-50"
        >
          <MaterialIcon name="inventory_2" className="text-lg" />
        </button>
      ) : (
        <button
          type="button"
          title="Restore to draft"
          disabled={restoreMut.isPending}
          onClick={() => restoreMut.mutate(p.id)}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#006b2d]/10 hover:text-[#006b2d] disabled:opacity-50"
        >
          <MaterialIcon name="restart_alt" className="text-lg" />
        </button>
      )}
      <a
        href={`/${p.slug.replace(/^\//, "")}`}
        target="_blank"
        rel="noreferrer"
        title="Preview on site (if published)"
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#1653cc]/5 hover:text-[#1653cc]"
      >
        <MaterialIcon name="open_in_new" className="text-lg" />
      </a>
      <button
        type="button"
        title={p.status === "ARCHIVED" ? "Permanently delete" : "Archive before permanent delete"}
        disabled={p.status !== "ARCHIVED"}
        onClick={() => {
          setDeleteErr(null);
          setDeleteTarget(p);
        }}
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-[#ba1a1a] disabled:cursor-not-allowed disabled:opacity-30"
      >
        <MaterialIcon name="delete_forever" className="text-lg" />
      </button>
    </div>
  ]);

  return (
    <StitchPageBody className="mx-auto w-full max-w-[1600px]">
      <ContentWorkspaceNav />
      <PageHeader
        title="CMS Pages"
        titleSize="deck"
        description="Create, publish, and archive storefront pages. Edit headline and body copy in plain language—no raw data entry required."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-content-pages"])]}
        actions={
          <button
            type="button"
            onClick={() => {
              setPanelPage(null);
              setPanel("create");
            }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2.5 font-semibold text-sm text-white shadow-lg shadow-[#1653cc]/10 transition-all hover:shadow-[#1653cc]/20"
          >
            <MaterialIcon name="add_circle" className="text-lg text-white" />
            Create Page
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#737685]/15 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border-none bg-[#f8f9fb] text-sm font-medium text-[#181b25] focus:ring-1 focus:ring-[#1653cc]"
          >
            <option value="">All</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}
      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading pages…</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <DataTableShell
            variant="stitchOperational"
            embedded
            columns={["Title", "Slug", "Last Updated", "Status", "Actions"]}
            rows={rows}
            rowKeys={filtered.map((p) => p.id)}
            emptyState="No pages match the current filters."
          />
        </div>
      )}

      {panel !== "closed" ? (
        <CmsPageFormPanel
          key={`${panel}-${panelPage?.id ?? "new"}`}
          mode={panel === "create" ? "create" : panel === "view" ? "view" : "edit"}
          page={panel === "create" ? null : panelPage}
          onClose={() => {
            setPanel("closed");
            setPanelPage(null);
          }}
          onSwitchToEdit={() => setPanel("edit")}
          onSaved={() => {
            invalidate();
            setPanel("closed");
            setPanelPage(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Permanently delete this page?"
        body={
          deleteErr
            ? deleteErr
            : "Only archived pages can be permanently removed. This cannot be undone."
        }
        confirmLabel="Delete permanently"
        danger
        confirmDisabled={deletePermMut.isPending}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteErr(null);
        }}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }
          setDeleteErr(null);
          deletePermMut.mutate(deleteTarget.id);
        }}
      />
    </StitchPageBody>
  );
};
