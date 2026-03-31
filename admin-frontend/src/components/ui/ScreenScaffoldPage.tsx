import { adminEndpointModules } from "@/lib/contracts/admin-endpoints";
import type { AdminScreenResolved } from "@/lib/contracts/admin-screen-catalog";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { KpiCard } from "@/components/primitives/KpiCard";
import { PageHeader } from "@/components/primitives/PageHeader";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { getStitchReference } from "@/lib/stitch/stitch-screen-map";

type ScreenScaffoldPageProps = {
  screen: AdminScreenResolved;
};

export const ScreenScaffoldPage = ({ screen }: ScreenScaffoldPageProps) => {
  const stitch = getStitchReference(screen.id);

  return (
  <div className="space-y-6">
    <PageHeader
      eyebrow={`Screen ${screen.sequence}`}
      title={screen.title}
      description={screen.purpose}
      actionMenuItems={[
        {
          id: "copy-route",
          label: "Copy route path",
          onSelect: () => {
            void navigator.clipboard?.writeText(screen.path);
          }
        },
        {
          id: "copy-screen-id",
          label: "Copy screen ID",
          onSelect: () => {
            void navigator.clipboard?.writeText(screen.id);
          }
        }
      ]}
      meta={
        <div className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-content)] px-3 py-2 text-sm text-[var(--color-text-body)]">
          <div className="font-medium text-[var(--color-text-dark)]">Frontend Route</div>
          <div className="mt-1 font-mono text-xs">{screen.path}</div>
        </div>
      }
      actions={<StatusBadge label={screen.group.replace(/-/g, " ")} tone="info" />}
    />

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Backend Endpoints"
        value={String(screen.endpoints.length)}
        detail="Mapped to the canonical backend route catalog."
        tone="primary"
      />
      <KpiCard
        label="Primary Actions"
        value={String(screen.actions.length)}
        detail="User actions expected on this screen."
        tone="success"
      />
      <KpiCard
        label="Permission Hints"
        value={String(screen.permissionHints.length)}
        detail="Backend permissions or access assumptions."
        tone="warning"
      />
      <KpiCard
        label="Module Coverage"
        value={String(new Set(screen.endpoints.map((endpoint) => endpoint.module)).size)}
        detail="Distinct backend domains involved."
        tone="neutral"
      />
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
      <SurfaceCard
        title="Backend Dependencies"
        description="Canonical admin endpoints mapped from the current backend route contract."
      >
        <DataTableShell
          columns={["Method", "Path", "Module", "Purpose"]}
          rows={screen.endpoints.map((endpoint) => [
            <span className="font-mono text-xs font-semibold text-[var(--color-text-dark)]">
              {endpoint.method}
            </span>,
            <span className="font-mono text-xs text-[var(--color-text-body)]">{endpoint.path}</span>,
            <StatusBadge label={endpoint.module} tone="draft" />,
            endpoint.purpose
          ])}
        />
      </SurfaceCard>

      <div className="space-y-6">
        <SurfaceCard title="Primary Actions" description="Actions the real UI should support on this route.">
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

        <SurfaceCard
          title="Permission Hints"
          description="Access rules that should shape button visibility and route guarding."
        >
          <div className="flex flex-wrap gap-2">
            {screen.permissionHints.length > 0 ? (
              screen.permissionHints.map((hint) => <StatusBadge key={hint} label={hint} tone="active" />)
            ) : (
              <span className="text-sm text-[var(--color-text-muted)]">
                Public or route-level auth only.
              </span>
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard
          title="Module Cross-Checks"
          description="Useful when splitting work across feature folders and data hooks."
        >
          <ul className="space-y-2 text-sm text-[var(--color-text-body)]">
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

        <SurfaceCard
          title="Stitch reference (repo)"
          description="Exported HTML/screenshot from Google Stitch. Port into React using DESIGN.md tokens and admin primitives — do not iframe raw HTML in production."
        >
          {stitch ? (
            <dl className="space-y-3 text-sm text-[var(--color-text-body)]">
              <div>
                <dt className="font-medium text-[var(--color-text-dark)]">Export slug</dt>
                <dd className="mt-1 font-mono text-xs">{stitch.slug}</dd>
              </div>
              <div>
                <dt className="font-medium text-[var(--color-text-dark)]">Markup</dt>
                <dd className="mt-1 break-all font-mono text-xs">{stitch.codeHtml}</dd>
              </div>
              <div>
                <dt className="font-medium text-[var(--color-text-dark)]">Screenshot</dt>
                <dd className="mt-1 break-all font-mono text-xs">{stitch.screenPng}</dd>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                MCP: use Stitch <span className="font-mono">list_screens</span> /{" "}
                <span className="font-mono">get_screen</span> with your project id; see{" "}
                <span className="font-mono">docs/admin frontend UI /README.md</span>.
              </p>
            </dl>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              No Stitch folder mapped for <span className="font-mono">{screen.id}</span>. Add an entry in{" "}
              <span className="font-mono">src/lib/stitch/stitch-screen-map.ts</span>.
            </p>
          )}
        </SurfaceCard>
      </div>
    </section>
  </div>
  );
};
