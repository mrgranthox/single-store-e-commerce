/**
 * Stitch sales report — gross vs net revenue trend (dual series, area + line).
 */
export const DualMetricTrendChart = ({
  points,
  formatValue
}: {
  points: Array<{ date: string; grossCents: number; netCents: number }>;
  formatValue: (cents: number) => string;
}) => {
  if (points.length === 0) return null;
  const w = 640;
  const h = 220;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxY = Math.max(
    ...points.map((p) => Math.max(p.grossCents, p.netCents)),
    1
  );
  const n = points.length;
  const step = n <= 1 ? innerW : innerW / (n - 1);

  const linePath = (key: "grossCents" | "netCents") =>
    points
      .map((p, i) => {
        const x = padL + i * step;
        const y = padT + innerH - (p[key] / maxY) * innerH;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const areaPath = (key: "grossCents" | "netCents") => {
    const coords = points.map((p, i) => {
      const x = padL + i * step;
      const y = padT + innerH - (p[key] / maxY) * innerH;
      return { x, y };
    });
    const lineD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
    const last = coords[coords.length - 1]!;
    const first = coords[0]!;
    return `${lineD} L ${last.x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${first.x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;
  };

  return (
    <div>
      <svg
        className="h-auto w-full max-w-full text-[#94a3b8]"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Gross and net revenue over time"
      >
        <defs>
          <linearGradient id="reportGrossFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="reportNetFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1653cc" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#1653cc" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1={padL}
            x2={w - padR}
            y1={padT + (innerH / 3) * i}
            y2={padT + (innerH / 3) * i}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={1}
          />
        ))}
        <path d={areaPath("grossCents")} fill="url(#reportGrossFill)" />
        <path
          d={linePath("grossCents")}
          fill="none"
          stroke="#64748b"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path d={areaPath("netCents")} fill="url(#reportNetFill)" />
        <path
          d={linePath("netCents")}
          fill="none"
          stroke="#1653cc"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <text x={padL} y={h - 6} className="fill-[#94a3b8] font-mono text-[9px]">
          {points[0]?.date ?? ""}
        </text>
        <text x={w - padR} y={h - 6} textAnchor="end" className="fill-[#94a3b8] font-mono text-[9px]">
          {points[points.length - 1]?.date ?? ""}
        </text>
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-medium text-[#60626c]">
        <span className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm bg-[#64748b]" /> Gross revenue
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm bg-[#1653cc]" /> Net revenue
        </span>
      </div>
      <ul className="sr-only">
        {points.map((p) => (
          <li key={p.date}>
            {p.date}: gross {formatValue(p.grossCents)}, net {formatValue(p.netCents)}
          </li>
        ))}
      </ul>
    </div>
  );
};
