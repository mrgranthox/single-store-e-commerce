import clsx from "clsx";

type Props = {
  /** Data rows (excluding header). */
  rowCount?: number;
  /** Column placeholders. */
  columnCount?: number;
  className?: string;
};

/**
 * Loading chrome for Stitch-style operational tables (filter row stays real; table body skeleton).
 */
export const StitchOperationalTableSkeleton = ({
  rowCount = 8,
  columnCount = 6,
  className
}: Props) => (
  <div
    className={clsx("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm", className)}
    aria-busy="true"
    aria-label="Loading table"
  >
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] table-fixed border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {Array.from({ length: columnCount }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <div className="h-3 w-16 max-w-full animate-pulse rounded bg-slate-200" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, r) => (
            <tr key={r} className="border-b border-slate-100">
              {Array.from({ length: columnCount }).map((_, c) => (
                <td key={c} className="px-4 py-3.5">
                  <div
                    className="h-4 max-w-[160px] animate-pulse rounded bg-slate-100"
                    style={{ width: `${55 + ((r + c) % 5) * 8}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
