import { useId } from "react";

/** Stitch-style decorative trend spark (visual only; not time-series data). */
export const MiniSparkline = ({
  className = "",
  stroke = "#1653cc",
  variant = "up"
}: {
  className?: string;
  stroke?: string;
  variant?: "up" | "flat" | "down";
}) => {
  const uid = useId().replace(/:/g, "");
  const fillId = `sparkFill-${uid}`;
  const d =
    variant === "up"
      ? "M0 14 L6 10 L12 12 L18 6 L24 8 L30 4 L36 2 L42 5 L48 3"
      : variant === "down"
        ? "M0 4 L6 8 L12 6 L18 12 L24 10 L30 14 L36 12 L42 14 L48 12"
        : "M0 8 L8 9 L16 7 L24 10 L32 8 L40 9 L48 8";

  return (
    <svg
      className={className}
      width="52"
      height="18"
      viewBox="0 0 52 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L48 16 L0 16 Z`}
        fill={`url(#${fillId})`}
        stroke="none"
        transform="translate(2 0)"
      />
      <path
        d={d}
        transform="translate(2 0)"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.85"
      />
    </svg>
  );
};
