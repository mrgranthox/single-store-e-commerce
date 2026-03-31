import type { ReactNode } from "react";
import clsx from "clsx";

type KpiCardTone = "primary" | "success" | "warning" | "danger" | "neutral";

type KpiCardProps = {
  label: string;
  value: string;
  detail?: string;
  delta?: string;
  tone?: KpiCardTone;
  icon?: ReactNode;
};

const accentClasses: Record<KpiCardTone, string> = {
  primary: "bg-[rgba(79,126,248,0.12)] text-[var(--color-primary)]",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
  neutral: "bg-slate-100 text-slate-700"
};

export const KpiCard = ({
  label,
  value,
  detail,
  delta,
  tone = "neutral",
  icon
}: KpiCardProps) => (
  <article className="rounded-xl border border-[var(--color-border-light)] bg-white px-5 py-5 shadow-card">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          {label}
        </div>
        <div className="mt-3 font-headline text-[28px] font-bold leading-none text-[var(--color-text-dark)]">
          {value}
        </div>
      </div>

      <div className={clsx("rounded-lg p-2", accentClasses[tone])}>{icon ?? value.slice(0, 1)}</div>
    </div>

    {detail || delta ? (
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {delta ? (
          <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">{delta}</span>
        ) : null}
        {detail ? <span className="text-[var(--color-text-muted)]">{detail}</span> : null}
      </div>
    ) : null}
  </article>
);
