import type { PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";

/** Stitch orders_list / product_list filter container */
export const StitchFilterPanel = ({
  children,
  className
}: PropsWithChildren<{ className?: string }>) => (
  <div
    className={clsx(
      "rounded-xl border border-slate-100 bg-white p-4 shadow-sm",
      className
    )}
  >
    {children}
  </div>
);

/** Stitch uppercase label (0.6875rem / 11px) */
export const StitchFieldLabel = ({
  children,
  className
}: PropsWithChildren<{ className?: string }>) => (
  <span
    className={clsx(
      "mb-2 block text-[11px] font-bold uppercase tracking-wider text-[#737685]",
      className
    )}
  >
    {children}
  </span>
);

export const stitchInputClass =
  "w-full rounded-lg border-0 bg-[#f2f3ff] px-3 py-2.5 text-xs text-[#181b25] placeholder:text-[#737685]/80 focus:outline-none focus:ring-2 focus:ring-[#1653cc]/25";

export const stitchSelectClass = stitchInputClass;

/** Page vertical rhythm (Stitch main uses ~32px section gaps) */
export const StitchPageBody = ({ children, className }: PropsWithChildren<{ className?: string }>) => (
  <div className={clsx("flex flex-col gap-8", className)}>{children}</div>
);

const breadcrumbLinkDefault = "text-[#737685] transition-colors hover:text-[#1653cc]";
const breadcrumbLinkEmphasis =
  "font-semibold text-[#1653cc] underline decoration-[#1653cc]/50 underline-offset-2 transition-colors hover:text-[#0f3d99] hover:decoration-[#1653cc]";

/** Detail hero breadcrumb row */
export const StitchBreadcrumbs = ({
  items,
  emphasizeLinks = false
}: {
  items: { label: string; to?: string }[];
  /** High-contrast links (security / Stitch explorer parity). */
  emphasizeLinks?: boolean;
}) => (
  <nav
    className="mb-2 flex flex-wrap items-center gap-y-1 text-[10px] font-semibold uppercase tracking-widest text-[#737685]"
    aria-label="Breadcrumb"
  >
    {items.map((item, i) => (
      <span key={`${item.label}-${i}`} className="flex items-center">
        {i > 0 ? <span className="mx-2 text-slate-300">/</span> : null}
        {item.to ? (
          <Link
            className={emphasizeLinks ? breadcrumbLinkEmphasis : breadcrumbLinkDefault}
            to={item.to}
          >
            {item.label}
          </Link>
        ) : (
          <span className={i === items.length - 1 ? "text-[#181b25]" : ""}>{item.label}</span>
        )}
      </span>
    ))}
  </nav>
);

/** Stitch primary / secondary toolbar buttons (order_detail) */
export const StitchSecondaryButton = ({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    className={clsx(
      "rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 transition-colors hover:bg-slate-50",
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

export const StitchGradientButton = ({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    className={clsx(
      "rounded-md bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-[#1653cc]/20 transition-transform hover:opacity-95 active:scale-[0.98]",
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

/** Mini KPI strip cell (orders_list) */
export const StitchKpiMicro = ({
  label,
  value,
  footer,
  barClass
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  barClass: string;
}) => (
  <div className="relative flex min-w-[140px] flex-col justify-between overflow-hidden rounded-xl bg-white p-4 shadow-sm">
    <div className={clsx("absolute bottom-0 left-0 top-0 w-1", barClass)} />
    <span className="text-[11px] font-bold uppercase tracking-wider text-[#737685]">{label}</span>
    <span className="mt-1 font-headline text-2xl font-bold text-[#181b25]">{value}</span>
    {footer ? <div className="mt-1 self-end text-[11px]">{footer}</div> : null}
  </div>
);

/** JSON / analytics block */
export const StitchCodePanel = ({ children, title }: { title?: string; children: ReactNode }) => (
  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    {title ? (
      <header className="border-b border-slate-100 px-5 py-3">
        <h2 className="font-headline text-sm font-bold text-[#181b25]">{title}</h2>
      </header>
    ) : null}
    <div className="p-4">{children}</div>
  </section>
);
