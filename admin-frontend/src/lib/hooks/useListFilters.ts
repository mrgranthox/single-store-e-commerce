import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * URL-synchronised filter + pagination state for list pages.
 *
 * All applied filter values are stored in URL search params so that:
 * - Refreshing the page restores the exact filter state
 * - Back-navigation returns to the filtered list (not an empty page)
 * - Filtered views are shareable via URL
 *
 * Usage:
 * ```ts
 * const { filters, page, set, setPage, reset } = useListFilters({
 *   defaults: { status: "", search: "", dateFrom: "" }
 * });
 * ```
 *
 * Text search "draft" state (before the user hits Enter / Apply) should remain
 * in local `useState` to avoid re-querying on every keystroke.  Call
 * `set("search", draftValue)` only when the user commits the input.
 */
export function useListFilters<TFilters extends Record<string, string>>(options: {
  defaults: TFilters;
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read current values from the URL, falling back to defaults
  const filters = Object.fromEntries(
    Object.keys(options.defaults).map((key) => [
      key,
      searchParams.get(key) ?? options.defaults[key as keyof TFilters],
    ]),
  ) as TFilters;

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const setPage = useCallback(
    (nextPage: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextPage <= 1) next.delete("page");
          else next.set("page", String(nextPage));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const set = useCallback(
    <K extends keyof TFilters>(key: K, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const defaultVal = options.defaults[key];
          if (value === defaultVal || value === "") next.delete(key as string);
          else next.set(key as string, value);
          next.delete("page"); // always reset to page 1 when a filter changes
          return next;
        },
        { replace: true },
      );
    },
    [options.defaults, setSearchParams],
  );

  const setMany = useCallback(
    (partial: Partial<TFilters>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(partial)) {
            const defaultVal = options.defaults[key];
            if (value == null || value === defaultVal || value === "") next.delete(key);
            else next.set(key, value);
          }
          next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [options.defaults, setSearchParams],
  );

  const reset = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => value !== (options.defaults[key] ?? ""),
  );

  return { filters, page, setPage, set, setMany, reset, hasActiveFilters };
}
