/**
 * Stitch Screen 6 — 30-day net revenue trend as line + area (muted blue).
 */
export const NetRevenueAreaChart = ({
  points,
  formatValue
}: {
  points: Array<{ date: string; netCents: number }>;
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
  const maxY = Math.max(...points.map((p) => p.netCents), 1);
  const n = points.length;
  const step = n <= 1 ? innerW : innerW / (n - 1);
  const coords = points.map((p, i) => {
    const x = padL + i * step;
    const y = padT + innerH - (p.netCents / maxY) * innerH;
    return { x, y, ...p };
  });
  const lineD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L ${coords[coords.length - 1]!.x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${coords[0]!.x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  return (
    <svg
      className="h-auto w-full max-w-full text-[#94a3b8]"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Net revenue trend, last 30 days, area chart"
    >
      <defs>
        <linearGradient id="execRevFill" x1="0" y1="0" x2="0" y2="1">
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
      <path d={areaD} fill="url(#execRevFill)" />
      <path
        d={lineD}
        fill="none"
        stroke="#1653cc"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map((c) => (
        <circle key={c.date} cx={c.x} cy={c.y} r={3} fill="#1653cc">
          <title>{`${c.date}: ${formatValue(c.netCents)}`}</title>
        </circle>
      ))}
      <text x={padL} y={h - 6} className="fill-[#94a3b8] font-mono text-[9px]">
        {points[0]?.date ?? ""}
      </text>
      <text x={w - padR} y={h - 6} textAnchor="end" className="fill-[#94a3b8] font-mono text-[9px]">
        {points[points.length - 1]?.date ?? ""}
      </text>
    </svg>
  );
};
