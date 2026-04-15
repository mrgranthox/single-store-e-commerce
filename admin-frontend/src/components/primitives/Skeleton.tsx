import type { CSSProperties } from "react";

/**
 * Fine-grained skeleton shimmer building blocks.
 *
 * Design tokens mirror the Stitch surface palette so skeletons blend
 * into the admin shell without layout shift.
 */

type SkeletonProps = {
  className?: string;
  /** aria-label for the enclosing region */
  label?: string;
};

/** Bare shimmer block — compose this for any shape */
export const Shimmer = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-[#eef1f8] ${className}`} />
);

/** Single line of text */
export const SkeletonText = ({
  width = "w-full",
  height = "h-4",
}: {
  width?: string;
  height?: string;
}) => <Shimmer className={`${height} ${width} rounded-md`} />;

/** KPI metric card — matches StitchKpiMicro / KpiCard layout */
export const SkeletonKpi = () => (
  <div className="rounded-2xl border border-[#eef1f8] bg-white p-5 flex flex-col gap-3">
    <Shimmer className="h-3 w-24 rounded" />
    <Shimmer className="h-8 w-32 rounded-lg" />
    <Shimmer className="h-2 w-16 rounded" />
  </div>
);

/** Row of N KPI cards */
export const SkeletonKpiRow = ({ count = 4 }: { count?: number }) => (
  <div
    className="grid gap-4"
    style={{ gridTemplateColumns: `repeat(${count}, minmax(0,1fr))` }}
    aria-busy="true"
    aria-label="Loading metrics"
  >
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonKpi key={i} />
    ))}
  </div>
);

/** Generic table skeleton */
export const SkeletonTable = ({
  rows = 6,
  cols = 5,
  label,
}: {
  rows?: number;
  cols?: number;
} & SkeletonProps) => (
  <div aria-busy="true" aria-label={label ?? "Loading table"}>
    {/* Header */}
    <div
      className="grid gap-3 px-4 py-3 border-b border-[#eef1f8]"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <Shimmer key={i} className="h-3 rounded" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, r) => (
      <div
        key={r}
        className="grid gap-3 px-4 py-4 border-b border-[#f4f6fb]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {Array.from({ length: cols }).map((_, c) => (
          <Shimmer
            key={c}
            className={`h-4 rounded ${c === 0 ? "w-3/4" : c === cols - 1 ? "w-1/2" : ""}`}
          />
        ))}
      </div>
    ))}
  </div>
);

/** Chart area placeholder */
export const SkeletonChart = ({
  height = "h-64",
  label,
}: { height?: string } & SkeletonProps) => (
  <div
    aria-busy="true"
    aria-label={label ?? "Loading chart"}
    className={`rounded-2xl border border-[#eef1f8] bg-white p-5 ${height}`}
  >
    <div className="flex flex-col h-full gap-3">
      <Shimmer className="h-4 w-32 rounded" />
      <div className="flex-1 flex items-end gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-[#eef1f8]"
            style={{ height: `${30 + Math.sin(i) * 30 + 40}%` } as CSSProperties}
          />
        ))}
      </div>
    </div>
  </div>
);

/** Detail page hero / header */
export const SkeletonDetailHero = () => (
  <div
    className="rounded-2xl border border-[#eef1f8] bg-white p-6 flex flex-col gap-4"
    aria-busy="true"
    aria-label="Loading details"
  >
    <div className="flex items-start gap-4">
      <Shimmer className="h-14 w-14 rounded-xl" />
      <div className="flex-1 flex flex-col gap-2">
        <Shimmer className="h-6 w-48 rounded-lg" />
        <Shimmer className="h-4 w-72 rounded" />
        <div className="flex gap-2 mt-1">
          <Shimmer className="h-5 w-16 rounded-full" />
          <Shimmer className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-4 pt-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <Shimmer className="h-3 w-16 rounded" />
          <Shimmer className="h-4 w-24 rounded" />
        </div>
      ))}
    </div>
  </div>
);

/** Filter toolbar skeleton (matches StitchFilterPanel width) */
export const SkeletonFilterBar = ({ fields = 4 }: { fields?: number }) => (
  <div className="flex gap-3 flex-wrap" aria-busy="true" aria-label="Loading filters">
    {Array.from({ length: fields }).map((_, i) => (
      <Shimmer
        key={i}
        className={`h-9 rounded-lg ${i === 0 ? "w-48" : "w-36"}`}
      />
    ))}
    <Shimmer className="h-9 w-20 rounded-lg" />
  </div>
);

/** Full list page skeleton — filter bar + table */
export const SkeletonListPage = ({
  filterFields = 4,
  rows = 8,
  cols = 5,
}: {
  filterFields?: number;
  rows?: number;
  cols?: number;
}) => (
  <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading list">
    {/* Page header */}
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-2">
        <Shimmer className="h-7 w-40 rounded-lg" />
        <Shimmer className="h-4 w-64 rounded" />
      </div>
      <Shimmer className="h-9 w-28 rounded-lg" />
    </div>
    <SkeletonFilterBar fields={filterFields} />
    <SkeletonTable rows={rows} cols={cols} />
  </div>
);
