import * as Sentry from "@sentry/react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Human-readable name shown in the fallback UI (e.g. "Orders", "Catalog") */
  feature: string;
  /** Optional compact mode — renders a single-line banner instead of a card */
  compact?: boolean;
};

const InlineErrorFallback = ({
  feature,
  onRetry,
}: {
  feature: string;
  onRetry: () => void;
}) => (
  <div
    role="alert"
    className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
  >
    <span className="shrink-0 text-base" aria-hidden>⚠</span>
    <span className="flex-1">
      <strong>{feature}</strong> encountered an unexpected error.
    </span>
    <button
      type="button"
      onClick={onRetry}
      className="shrink-0 rounded border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
    >
      Retry
    </button>
  </div>
);

const CardErrorFallback = ({
  feature,
  onRetry,
}: {
  feature: string;
  onRetry: () => void;
}) => (
  <div
    role="alert"
    className="flex flex-col items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-6"
  >
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-red-400">Error</p>
      <h2 className="mt-1 text-lg font-bold text-red-900">{feature} failed to load</h2>
      <p className="mt-1 text-sm text-red-700">
        This section encountered an unexpected error. Your data is safe — try reloading.
      </p>
    </div>
    <button
      type="button"
      onClick={onRetry}
      className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
    >
      Reload section
    </button>
  </div>
);

/**
 * Wraps a feature section in a Sentry-aware error boundary.
 *
 * Use around major feature subtrees so that a crash in one domain
 * (e.g. Payments) doesn't blow up unrelated screens.
 *
 * ```tsx
 * <FeatureErrorBoundary feature="Orders">
 *   <OrdersListPage />
 * </FeatureErrorBoundary>
 * ```
 */
export const FeatureErrorBoundary = ({ children, feature, compact = false }: Props) => (
  <Sentry.ErrorBoundary
    fallback={({ resetError }) =>
      compact ? (
        <InlineErrorFallback feature={feature} onRetry={resetError} />
      ) : (
        <CardErrorFallback feature={feature} onRetry={resetError} />
      )
    }
    beforeCapture={(scope) => {
      scope.setTag("feature", feature);
    }}
  >
    {children}
  </Sentry.ErrorBoundary>
);
