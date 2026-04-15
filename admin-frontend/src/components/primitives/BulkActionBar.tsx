import type { PropsWithChildren } from "react";
import clsx from "clsx";

type BulkActionBarProps = PropsWithChildren<{
  /** Number of selected items — bar is hidden when 0 */
  count?: number;
  /** Extra className on the container */
  className?: string;
}>;

/**
 * BulkActionBar — sticky bottom bar that slides in when items are selected.
 * Wrap list page table areas in a `relative` container and this bar will
 * stick to the bottom of the viewport within that scroll context.
 *
 * When `count` is provided and equals 0, the bar is invisible (no layout shift).
 */
export const BulkActionBar = ({ children, count, className }: BulkActionBarProps) => {
  const visible = count === undefined || count > 0;

  return (
    <div
      className={clsx(
        "sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e0e2f0] bg-[#f8f9fb] px-4 py-3 shadow-md transition-all duration-200",
        visible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2",
        className
      )}
    >
      {children}
    </div>
  );
};
