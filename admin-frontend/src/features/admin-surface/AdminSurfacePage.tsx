import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQueries, useQueryClient } from "@tanstack/react-query";

import { AdminResponseBodyView } from "@/components/primitives/DataPresentation";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { PageHeader } from "@/components/primitives/PageHeader";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { adminEndpointModules } from "@/lib/contracts/admin-endpoints";
import type { AdminScreenResolved } from "@/lib/contracts/admin-screen-catalog";
import { adminScreenLookup } from "@/lib/contracts/admin-screen-catalog";
import { getStitchReference } from "@/lib/stitch/stitch-screen-map";
import { resolveEndpointPath } from "@/lib/admin-paths/resolveEndpointPath";
import { adminJsonGet, type AdminSuccessEnvelope } from "@/lib/api/admin-get";
import { ApiError } from "@/lib/api/http";
import type { PageActionItem } from "@/components/primitives/PageActionsMenu";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { refreshDataMenuItem } from "@/lib/page-action-menu";

type AdminSurfacePageProps = {
  screenId: keyof typeof adminScreenLookup;
};

type ResolvedGet = {
  endpointId: string;
  method: string;
  pathTemplate: string;
  resolvedPath: string | null;
  purpose: string;
  module: string;
  skippedReason?: string;
};

const DataPreview = ({ envelope }: { envelope: AdminSuccessEnvelope }) => (
  <AdminResponseBodyView data={envelope.data} meta={envelope.meta} />
);

const buildResolvedGets = (screen: AdminScreenResolved, routeParams: Record<string, string | undefined>): ResolvedGet[] =>
  screen.endpoints
    .filter((endpoint) => endpoint.method === "GET")
    .map((endpoint) => {
      const needsParams = endpoint.path.includes(":");
      const resolvedPath = resolveEndpointPath(endpoint.path, routeParams);

      if (needsParams && resolvedPath === null) {
        return {
          endpointId: endpoint.id,
          method: endpoint.method,
          pathTemplate: endpoint.path,
          resolvedPath: null,
          purpose: endpoint.purpose,
          module: endpoint.module,
          skippedReason: "This endpoint needs URL parameters (open from a list row or deep link)."
        };
      }

      return {
        endpointId: endpoint.id,
        method: endpoint.method,
        pathTemplate: endpoint.path,
        resolvedPath,
        purpose: endpoint.purpose,
        module: endpoint.module
      };
    });

export const AdminSurfacePage = ({ screenId }: AdminSurfacePageProps) => {
  const screen = adminScreenLookup[screenId];
  const routeParams = useParams();
  const accessToken = useAdminAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const stitch = getStitchReference(screen.id);

  const resolvedGets = useMemo(() => buildResolvedGets(screen, routeParams), [screen, routeParams]);

  const fetchable = resolvedGets.filter((entry) => entry.resolvedPath !== null) as Array<
    ResolvedGet & { resolvedPath: string }
  >;

  const results = useQueries({
    queries: fetchable.map((entry) => ({
      queryKey: ["admin-surface", screen.id, entry.endpointId, entry.resolvedPath],
      queryFn: () => adminJsonGet(entry.resolvedPath, accessToken),
      enabled: Boolean(accessToken) && Boolean(entry.resolvedPath),
      staleTime: 20_000
    }))
  });

  const resultByEndpointId = useMemo(() => {
    const map = new Map<string, (typeof results)[number]>();
    fetchable.forEach((entry, index) => {
      map.set(entry.endpointId, results[index]);
    });
    return map;
  }, [fetchable, results]);

  const actionMenuItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = [
      refreshDataMenuItem(queryClient, ["admin-surface", screen.id]),
      {
        id: "jump-mutations",
        label: "Jump to write endpoints",
        onSelect: () =>
          document.getElementById("admin-surface-mutations")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    ];
    if (screen.actions.length > 0) {
      items.push({ id: "sec-catalog", label: "Catalog intents", kind: "section" });
      screen.actions.forEach((label, index) => {
        items.push({
          id: `catalog-intent-${index}`,
          label,
          onSelect: () =>
            document.getElementById("admin-surface-intents")?.scrollIntoView({ behavior: "smooth", block: "start" })
        });
      });
    }
    return items;
  }, [queryClient, screen.actions, screen.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Screen ${screen.sequence}`}
        title={screen.title}
        description={<p>{screen.purpose}</p>}
        meta={
          <div className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-content)] px-3 py-2 text-sm text-[var(--color-text-body)]">
            <div className="font-medium text-[var(--color-text-dark)]">Route</div>
            <div className="mt-1 font-mono text-xs">{screen.path}</div>
          </div>
        }
        actionMenuItems={actionMenuItems}
        actions={<StatusBadge label={screen.group.replace(/-/g, " ")} tone="info" />}
      />

      <div
        className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
        role="status"
      >
        <span className="font-semibold">Catalog preview surface.</span>{" "}
        This route is wired to the screen contract but does not yet use the dedicated Stitch-aligned page. Use it to inspect
        API payloads until the final UI ships; production operators should prefer the finished workspace when available.
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {resolvedGets.map((entry) => {
          if (entry.resolvedPath === null) {
            return (
              <SurfaceCard key={entry.endpointId} title={entry.purpose} description={`${entry.module} · ${entry.method}`}>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {entry.skippedReason ?? "Missing URL parameters for this endpoint."}
                </div>
                <details className="mt-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-content)] px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-[var(--color-text-muted)]">API reference</summary>
                  <p className="mt-2 font-mono text-[10px] text-[var(--color-text-body)]">{entry.endpointId}</p>
                  <p className="mt-1 break-all font-mono text-[10px] text-[var(--color-text-muted)]">
                    {entry.pathTemplate}
                  </p>
                </details>
              </SurfaceCard>
            );
          }

          const query = resultByEndpointId.get(entry.endpointId);
          if (!query) {
            return (
              <SurfaceCard key={entry.endpointId} title={entry.purpose} description={`${entry.module} · ${entry.method}`}>
                <p className="text-sm text-red-700">Missing query state for this endpoint.</p>
                <details className="mt-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-content)] px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-[var(--color-text-muted)]">API reference</summary>
                  <p className="mt-2 font-mono text-[10px] text-[var(--color-text-body)]">{entry.endpointId}</p>
                </details>
              </SurfaceCard>
            );
          }

          return (
            <SurfaceCard key={entry.endpointId} title={entry.purpose} description={`${entry.module} · ${entry.method}`}>
              <details className="mb-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-content)] px-3 py-2 text-xs">
                <summary className="cursor-pointer font-semibold text-[var(--color-text-muted)]">API reference</summary>
                <p className="mt-2 font-mono text-[10px] text-[var(--color-text-body)]">{entry.endpointId}</p>
                <p className="mt-1 break-all font-mono text-[10px] text-[var(--color-text-muted)]">{entry.resolvedPath}</p>
              </details>

              {query.isLoading ? (
                <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
              ) : query.isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {query.error instanceof ApiError ? query.error.message : "Request failed."}
                  {query.error instanceof ApiError && query.error.statusCode === 403 ? (
                    <span className="mt-1 block text-xs">Check RBAC permissions for this route.</span>
                  ) : null}
                </div>
              ) : query.data ? (
                <DataPreview envelope={query.data} />
              ) : null}
            </SurfaceCard>
          );
        })}
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <SurfaceCard
          id="admin-surface-mutations"
          title="Mutation endpoints"
          description="Write operations for this screen (call via tooling or future forms)."
        >
          <DataTableShell
            columns={["Method", "Purpose", "API path"]}
            rows={screen.endpoints
              .filter((endpoint) => endpoint.method !== "GET")
              .map((endpoint) => [
                <span key={`m-${endpoint.id}`} className="font-mono text-xs font-semibold">
                  {endpoint.method}
                </span>,
                <span key={`u-${endpoint.id}`} className="text-sm text-[var(--color-text-body)]">
                  {endpoint.purpose}
                </span>,
                <span key={`p-${endpoint.id}`} className="break-all font-mono text-[10px] text-[var(--color-text-muted)]">
                  {endpoint.path}
                </span>
              ])}
            emptyState="No write operations declared for this screen."
          />
        </SurfaceCard>

        <div className="space-y-6">
          <SurfaceCard id="admin-surface-intents" title="Primary actions" description="Product intent for this screen.">
            <ul className="space-y-2 text-sm text-[var(--color-text-body)]">
              {screen.actions.map((action) => (
                <li
                  key={action}
                  className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-content)] px-3 py-3"
                >
                  {action}
                </li>
              ))}
            </ul>
          </SurfaceCard>

          <SurfaceCard title="Permission hints" description="Backend-enforced access.">
            <div className="flex flex-wrap gap-2">
              {screen.permissionHints.length > 0 ? (
                screen.permissionHints.map((hint) => <StatusBadge key={hint} label={hint} tone="active" />)
              ) : (
                <span className="text-sm text-[var(--color-text-muted)]">None listed.</span>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Modules" description="Cross-check for feature ownership.">
            <ul className="space-y-2 text-sm">
              {Array.from(new Set(screen.endpoints.map((endpoint) => endpoint.module)))
                .filter((moduleName): moduleName is (typeof adminEndpointModules)[number] =>
                  adminEndpointModules.includes(moduleName)
                )
                .map((moduleName) => (
                  <li
                    key={moduleName}
                    className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-content)] px-3 py-2"
                  >
                    {moduleName}
                  </li>
                ))}
            </ul>
          </SurfaceCard>

          <SurfaceCard title="Stitch reference (repo)" description="Design export for pixel polish when you replace this surface.">
            {stitch ? (
              <dl className="space-y-2 text-xs text-[var(--color-text-body)]">
                <div>
                  <dt className="font-medium text-[var(--color-text-dark)]">Slug</dt>
                  <dd className="mt-1 font-mono">{stitch.slug}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--color-text-dark)]">Markup</dt>
                  <dd className="mt-1 break-all font-mono">{stitch.codeHtml}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">
                Map <span className="font-mono">{screen.id}</span> in{" "}
                <span className="font-mono">stitch-screen-map.ts</span>.
              </p>
            )}
          </SurfaceCard>
        </div>
      </section>
    </div>
  );
};
