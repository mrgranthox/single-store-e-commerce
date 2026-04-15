/**
 * Full-page loading shell used as the Suspense fallback during lazy route loads.
 * Matches the storefront surface colour so there's no flash of unstyled content.
 */
export const PageLoader = () => (
  <div
    role="status"
    aria-label="Loading page"
    className="flex min-h-screen items-center justify-center bg-surface"
  >
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
      <p className="text-sm font-medium text-on-surface-variant">Loading…</p>
    </div>
  </div>
);
