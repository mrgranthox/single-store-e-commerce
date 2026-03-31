import type { ReactNode } from "react";
import clsx from "clsx";

type DataTableShellProps = {
  columns: string[];
  rows: ReactNode[][];
  /** Stable keys for table rows; avoids remount flicker and improves a11y when provided. */
  rowKeys?: string[];
  emptyState?: string;
  /** Dense operational table (DESIGN.md: 44px header, 52px rows, #f8f9fb hover). */
  variant?: "default" | "stitchOperational";
  /** Parent already provides card border/radius (e.g. section shell + table body). */
  embedded?: boolean;
};

export const DataTableShell = ({
  columns,
  rows,
  rowKeys,
  emptyState = "No rows available.",
  variant = "default",
  embedded = false
}: DataTableShellProps) => {
  const stitch = variant === "stitchOperational";

  const inner = (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left">
        <thead>
          <tr
            className={clsx(
              "border-b",
              stitch ? "border-[#e5e7eb] bg-[#f8f9fb]" : "border-slate-200 bg-slate-50"
            )}
          >
            {columns.map((column) => (
              <th
                key={column}
                className={clsx(
                  "px-4 text-left align-middle font-semibold uppercase",
                  stitch
                    ? "h-11 text-[12px] tracking-[0.04em] text-[#6b7280]"
                    : "py-3 text-[11px] tracking-wider text-slate-500"
                )}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={stitch ? "" : "divide-y divide-slate-100"}>
          {rows.length > 0 ? (
            rows.map((row, index) => (
              <tr
                key={rowKeys?.[index] ?? `row-${index}`}
                className={clsx(
                  "transition-colors",
                  stitch
                    ? "group border-b border-[#f1f3f9] hover:bg-[#f8f9fb]"
                    : "hover:bg-[#e6e7f6]/80"
                )}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`row-${index}-cell-${cellIndex}`}
                    className={clsx(
                      "px-4 align-middle",
                      stitch ? "h-[52px] text-[13px] text-[#374151]" : "py-3 text-sm text-slate-700"
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                className={clsx(
                  "px-4 text-slate-500",
                  stitch ? "py-10 text-[13px]" : "py-8 text-sm"
                )}
                colSpan={columns.length}
              >
                {emptyState}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  if (embedded) {
    return inner;
  }

  return (
    <div
      className={clsx(
        "flex flex-col overflow-hidden rounded-xl border bg-white",
        stitch
          ? "border-[#e5e7eb] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]"
          : "border-slate-200 shadow-sm"
      )}
    >
      {inner}
    </div>
  );
};
