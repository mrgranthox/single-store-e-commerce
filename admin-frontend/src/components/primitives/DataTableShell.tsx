import type { ReactNode } from "react";
import clsx from "clsx";

export type ColumnDef = {
  label: string;
  key?: string;
  align?: "left" | "right" | "center";
  sortKey?: string;
};

type DataTableShellProps = {
  /** Column definitions. Accepts either a string (label only) or a ColumnDef object. */
  columns: (string | ColumnDef)[];
  rows: ReactNode[][];
  /** Stable keys for table rows; avoids remount flicker and improves a11y. */
  rowKeys?: string[];
  /** Empty state: string or a full ReactNode for intentful empty states with icons/CTAs. */
  emptyState?: ReactNode;
  /** Dense operational table (DESIGN.md: 44px header, 52px rows, #f8f9fb hover). */
  variant?: "default" | "stitchOperational";
  /** Parent already provides card border/radius. */
  embedded?: boolean;
  /** Active sort key for rendering sort direction indicators. */
  activeSortKey?: string;
  /** Active sort direction. */
  sortDir?: "asc" | "desc";
  /** Called when a sortable column header is clicked. */
  onSort?: (key: string) => void;
  /** Optional footer ReactNode rendered inside <tfoot> — use for totals rows. */
  footer?: ReactNode;
};

const normalizeColumn = (col: string | ColumnDef): ColumnDef =>
  typeof col === "string" ? { label: col } : col;

const SortIcon = ({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) => (
  <span className={clsx("ml-1 inline-flex flex-col gap-px", active ? "opacity-100" : "opacity-30")}>
    <span
      className={clsx(
        "h-0 w-0 border-x-[3px] border-b-[4px] border-x-transparent",
        active && dir === "asc" ? "border-b-[#1653cc]" : "border-b-current"
      )}
    />
    <span
      className={clsx(
        "h-0 w-0 border-x-[3px] border-t-[4px] border-x-transparent",
        active && dir === "desc" ? "border-t-[#1653cc]" : "border-t-current"
      )}
    />
  </span>
);

export const DataTableShell = ({
  columns,
  rows,
  rowKeys,
  emptyState = "No rows available.",
  variant = "default",
  embedded = false,
  activeSortKey,
  sortDir,
  onSort,
  footer
}: DataTableShellProps) => {
  const stitch = variant === "stitchOperational";
  const cols = columns.map(normalizeColumn);

  const alignClass = (align?: "left" | "right" | "center") => {
    if (align === "right") return "text-right";
    if (align === "center") return "text-center";
    return "text-left";
  };

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
            {cols.map((col) => {
              const isSortable = Boolean(col.sortKey && onSort);
              const isActive = Boolean(col.sortKey && col.sortKey === activeSortKey);
              return (
                <th
                  key={col.label}
                  className={clsx(
                    "px-4 align-middle font-semibold uppercase",
                    stitch
                      ? "h-11 text-xs tracking-[0.04em] text-[#6b7280]"
                      : "py-3 text-xs tracking-wider text-slate-500",
                    alignClass(col.align),
                    isSortable && "cursor-pointer select-none hover:text-[#1653cc]"
                  )}
                  onClick={isSortable ? () => onSort!(col.sortKey!) : undefined}
                  aria-sort={isActive ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    {isSortable ? <SortIcon active={isActive} dir={sortDir} /> : null}
                  </span>
                </th>
              );
            })}
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
                      stitch ? "h-[52px] text-[13px] text-[#374151]" : "py-3 text-sm text-slate-700",
                      alignClass(cols[cellIndex]?.align)
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
                  "px-4",
                  stitch ? "py-10 text-xs text-[#737685]" : "py-8 text-sm text-slate-500"
                )}
                colSpan={cols.length}
              >
                {emptyState}
              </td>
            </tr>
          )}
        </tbody>
        {footer ? (
          <tfoot>
            <tr
              className={clsx(
                "border-t font-semibold",
                stitch ? "border-[#e5e7eb] bg-[#f8f9fb]" : "border-slate-200 bg-slate-50"
              )}
            >
              {footer}
            </tr>
          </tfoot>
        ) : null}
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
