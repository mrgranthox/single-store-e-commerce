import type { PropsWithChildren, ReactNode } from "react";
import clsx from "clsx";

type SurfaceCardProps = PropsWithChildren<{
  id?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
}>;

export const SurfaceCard = ({
  id,
  title,
  description,
  action,
  className,
  contentClassName,
  children
}: SurfaceCardProps) => (
  <section
    id={id}
    className={clsx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}
  >
    {(title || description || action) && (
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          {title ? (
            <h2 className="font-headline text-base font-bold text-[#0f1117]">{title}</h2>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </header>
    )}
    <div className={clsx("px-5 py-5", contentClassName)}>{children}</div>
  </section>
);
