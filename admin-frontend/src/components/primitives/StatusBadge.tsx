import clsx from "clsx";

export type StatusBadgeTone =
  | "active"
  | "pending"
  | "danger"
  | "draft"
  | "warning"
  | "info";

type StatusBadgeProps = {
  label: string;
  tone?: StatusBadgeTone;
  className?: string;
};

const toneClasses: Record<StatusBadgeTone, string> = {
  active: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  danger: "bg-rose-100 text-rose-800",
  draft: "bg-slate-100 text-slate-700",
  warning: "bg-orange-100 text-orange-800",
  info: "bg-sky-100 text-sky-800"
};

export const StatusBadge = ({
  label,
  tone = "draft",
  className
}: StatusBadgeProps) => (
  <span
    className={clsx(
      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em]",
      toneClasses[tone],
      className
    )}
  >
    {label}
  </span>
);
