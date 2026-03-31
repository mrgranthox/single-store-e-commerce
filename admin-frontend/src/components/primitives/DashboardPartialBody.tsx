import { AlertCircle, Lock } from "lucide-react";

import { ApiError } from "@/lib/api/http";

export type DashboardPartialState = "loading" | "forbidden" | "error" | "empty" | "ready";

export const getDashboardPartialState = (input: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isEmpty?: boolean;
}): DashboardPartialState => {
  if (input.isLoading) return "loading";
  if (input.isError) {
    if (
      input.error instanceof ApiError &&
      (input.error.statusCode === 403 || input.error.statusCode === 401)
    ) {
      return "forbidden";
    }
    return "error";
  }
  if (input.isEmpty) return "empty";
  return "ready";
};

type Props = {
  state: DashboardPartialState;
  /** RBAC codes to show on 403, e.g. system.jobs.read */
  permissionsNeeded?: string[];
  /** Shown for generic errors; overrides message inferred from `error` */
  errorMessage?: string;
  /** Original fetch error (uses ApiError.message when errorMessage omitted) */
  error?: unknown;
  emptyLabel?: string;
  loadingLabel?: string;
  /** Main widget body; omitted for standalone banners (e.g. queue permission alerts). */
  children?: React.ReactNode;
};

/**
 * Unified body pattern for dashboard widgets: loading skeleton, permission gate,
 * error, empty, or main content. Rest of the dashboard stays usable (partial dashboard).
 */
export const DashboardPartialBody = ({
  state,
  permissionsNeeded,
  errorMessage,
  error,
  emptyLabel,
  loadingLabel,
  children
}: Props) => {
  if (state === "loading") {
    return (
      <div
        className="space-y-3 py-1"
        aria-busy="true"
        aria-live="polite"
        aria-label={loadingLabel ?? "Loading section"}
      >
        <div className="h-4 w-2/3 max-w-sm animate-pulse rounded bg-[var(--color-border-light)]" />
        <div className="h-16 max-w-md animate-pulse rounded-lg bg-[var(--color-primary-muted)]" />
      </div>
    );
  }

  if (state === "forbidden") {
    const codes = permissionsNeeded?.filter(Boolean).join(", ");
    return (
      <div
        role="status"
        className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-bg-page)] p-4 shadow-[var(--shadow-card)]"
        style={{ fontSize: "var(--text-sm)", lineHeight: 1.5, color: "var(--color-text-body)" }}
      >
        <div className="flex gap-3">
          <Lock className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" strokeWidth={2} aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-[var(--color-text-dark)]">This section needs more access</p>
            <p className="mt-1 text-[var(--color-text-muted)]">
              The rest of your dashboard still works. Ask an administrator to grant the required permission
              {codes ? (
                <>
                  : <span className="font-mono text-[length:var(--text-xs)]">{codes}</span>
                </>
              ) : (
                "."
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    const msg =
      errorMessage ??
      (error instanceof ApiError ? error.message : null) ??
      "We could not load this section. Try refreshing the page.";
    return (
      <div
        role="alert"
        className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 p-4"
        style={{ fontSize: "var(--text-sm)", lineHeight: 1.5, color: "#7f1d1d" }}
      >
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-700" strokeWidth={2} aria-hidden />
          <p>{msg}</p>
        </div>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <p className="text-[var(--color-text-muted)]" style={{ fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
        {emptyLabel ?? "Nothing to show in this slice yet."}
      </p>
    );
  }

  return <>{children}</>;
};
