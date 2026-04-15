import type { ReactNode } from "react";

type QueryErrorProps = {
  /** Human-readable label for what failed (e.g. "orders", "payment detail") */
  label?: string;
  /** The raw error from React Query's `.error` field */
  error?: unknown;
  /** Retry callback — pass `refetch` from the query result */
  onRetry?: () => void;
  /** Render as a compact single-line banner instead of a card */
  compact?: boolean;
  /** Custom content to render instead of the default message */
  children?: ReactNode;
};

function extractMessage(error: unknown): string {
  if (!error) return "An unexpected error occurred.";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  ) {
    return (error as Record<string, string>).message;
  }
  return "An unexpected error occurred.";
}

/**
 * Standardised error state component for query failures.
 *
 * Usage (full card):
 * ```tsx
 * if (query.isError) return <QueryError label="orders" error={query.error} onRetry={query.refetch} />;
 * ```
 *
 * Usage (compact banner, e.g. inside a section):
 * ```tsx
 * {query.isError && <QueryError compact label="metrics" error={query.error} onRetry={query.refetch} />}
 * ```
 */
export const QueryError = ({
  label,
  error,
  onRetry,
  compact = false,
  children,
}: QueryErrorProps) => {
  const message = children ? null : extractMessage(error);
  const heading = label ? `Failed to load ${label}` : "Failed to load";

  if (compact) {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <span className="shrink-0 text-base" aria-hidden>
          ⚠
        </span>
        <span className="flex-1 min-w-0">
          <strong className="font-semibold">{heading}.</strong>{" "}
          {children ?? <span className="opacity-80">{message}</span>}
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-8"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl shrink-0" aria-hidden>
          ⚠
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400 mb-1">
            Error
          </p>
          <h2 className="text-lg font-bold text-red-900">{heading}</h2>
          <p className="mt-1 text-sm text-red-700 leading-relaxed">
            {children ?? message}
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
};
