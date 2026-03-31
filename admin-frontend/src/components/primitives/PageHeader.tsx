import type { ReactNode } from "react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import type { PageActionItem } from "@/components/primitives/PageActionsMenu";
import { PageActionsMenu } from "@/components/primitives/PageActionsMenu";
import { getAdminBreadcrumbTrail, type AdminBreadcrumbItem } from "@/lib/stitch/admin-breadcrumbs";
import { useMatchedAdminScreen } from "@/lib/stitch/useMatchedAdminScreen";

export type { PageActionItem };

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  /** Screen titles: DESIGN.md 20px (text-xl). Deck pages (Stitch orders list): text-2xl. */
  titleSize?: "default" | "screen" | "deck";
  description: ReactNode;
  meta?: ReactNode;
  /** Extra nodes beside the Actions menu (e.g. badges). */
  actions?: ReactNode;
  /** Stitch-style primary “Actions” control (dropdown). */
  actionMenuItems?: PageActionItem[];
  actionMenuLabel?: string;
  /** Auto breadcrumb from catalog + sidebar (Stitch list/detail). */
  autoBreadcrumbs?: boolean;
  /** When set, replaces auto breadcrumbs (e.g. order number on detail). */
  breadcrumbItems?: AdminBreadcrumbItem[];
};

export const PageHeader = ({
  eyebrow,
  title,
  titleSize = "default",
  description,
  meta,
  actions,
  actionMenuItems,
  actionMenuLabel,
  autoBreadcrumbs = true,
  breadcrumbItems
}: PageHeaderProps) => {
  const matched = useMatchedAdminScreen();
  const crumbs = useMemo(() => {
    if (breadcrumbItems !== undefined) {
      return breadcrumbItems;
    }
    return autoBreadcrumbs ? getAdminBreadcrumbTrail(matched) : [];
  }, [autoBreadcrumbs, breadcrumbItems, matched]);

  return (
    <section className="flex flex-wrap items-end justify-between gap-4 pb-2 pt-0">
      <div className="max-w-3xl">
        {crumbs.length > 0 ? (
          <nav
            className="mb-2 flex flex-wrap items-center text-[10px] font-semibold uppercase tracking-widest text-[#737685]"
            aria-label="Breadcrumb"
          >
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center">
                {i > 0 ? <span className="mx-2 text-slate-300">/</span> : null}
                {c.to && i < crumbs.length - 1 ? (
                  <Link className="text-[#737685] transition-colors hover:text-[#1653cc]" to={c.to}>
                    {c.label}
                  </Link>
                ) : (
                  <span className={i === crumbs.length - 1 ? "text-[#181b25]" : ""}>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{eyebrow}</div>
        ) : null}
        <h1
          className={
            titleSize === "deck"
              ? "font-headline text-2xl font-bold tracking-tight text-[#181b25]"
              : titleSize === "screen"
                ? "font-headline text-xl font-bold tracking-tight text-[#0f1117]"
                : "font-headline text-3xl font-bold tracking-tight text-[#0f1117]"
          }
        >
          {title}
        </h1>
        <div className="mt-1 text-sm leading-relaxed text-slate-500">{description}</div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {meta}
        {actionMenuItems && actionMenuItems.length > 0 ? (
          <PageActionsMenu items={actionMenuItems} triggerLabel={actionMenuLabel} />
        ) : null}
        {actions}
      </div>
    </section>
  );
};
