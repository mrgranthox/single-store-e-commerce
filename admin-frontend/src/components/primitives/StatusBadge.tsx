import clsx from "clsx";

export type StatusBadgeTone =
  | "active"
  | "success"
  | "pending"
  | "danger"
  | "draft"
  | "warning"
  | "info"
  | "neutral";

type StatusBadgeProps = {
  label: string;
  tone?: StatusBadgeTone;
  /** Render as a dot+label inline indicator instead of a pill shape */
  dot?: boolean;
  className?: string;
};

const toneClasses: Record<StatusBadgeTone, { pill: string; dot: string }> = {
  active:  { pill: "bg-emerald-100 text-emerald-800",  dot: "bg-emerald-600"  },
  success: { pill: "bg-teal-100 text-teal-800",        dot: "bg-teal-600"     },
  pending: { pill: "bg-amber-100 text-amber-800",      dot: "bg-amber-500"    },
  danger:  { pill: "bg-rose-100 text-rose-800",        dot: "bg-rose-600"     },
  draft:   { pill: "bg-slate-100 text-slate-700",      dot: "bg-slate-400"    },
  warning: { pill: "bg-orange-100 text-orange-800",    dot: "bg-orange-500"   },
  info:    { pill: "bg-sky-100 text-sky-800",          dot: "bg-sky-500"      },
  neutral: { pill: "bg-gray-100 text-gray-700",        dot: "bg-gray-400"     },
};

export const StatusBadge = ({
  label,
  tone = "draft",
  dot = false,
  className
}: StatusBadgeProps) => {
  const { pill, dot: dotColor } = toneClasses[tone];

  if (dot) {
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1.5 text-xs font-medium",
          pill,
          className
        )}
      >
        <span className={clsx("h-1.5 w-1.5 rounded-full", dotColor)} />
        {label}
      </span>
    );
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-[0.08em]",
        pill,
        className
      )}
    >
      {label}
    </span>
  );
};
