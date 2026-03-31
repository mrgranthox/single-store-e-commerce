/** Single-metric trend (refunds, in-stock %, growth) — SVG for reports. */
export const SingleSeriesLineChart = ({
  points,
  formatY,
  ariaLabel,
  stroke = "#1653cc"
}: {
  points: Array<{ date: string; value: number }>;
  formatY: (n: number) => string;
  ariaLabel: string;
  stroke?: string;
}) => {
  if (points.length === 0) return null;
  const w = 640;
  const h = 200;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxY = Math.max(...points.map((p) => p.value), 1);
  const n = points.length;
  const step = n <= 1 ? innerW : innerW / (n - 1);
  const coords = points.map((p, i) => {
    const x = padL + i * step;
    const y = padT + innerH - (p.value / maxY) * innerH;
    return { x, y, ...p };
  });
  const lineD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");

  return (
    <svg
      className="h-auto w-full max-w-full text-[#94a3b8]"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={ariaLabel}
    >
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
      <path
        d={lineD}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map((c) => (
        <circle key={c.date} cx={c.x} cy={c.y} r={3} fill={stroke}>
          <title>{`${c.date}: ${formatY(c.value)}`}</title>
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

export const CategoryBarList = ({
  rows,
  formatValue
}: {
  rows: Array<{ label: string; value: number; pct: number }>;
  formatValue: (n: number) => string;
}) => {
  const maxV = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex justify-between text-xs font-medium text-[#374151]">
            <span>{row.label}</span>
            <span>
              {formatValue(row.value)} ({row.pct}%)
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#f1f3f9]">
            <div
              className="h-full rounded-full bg-[#1653cc]/80"
              style={{ width: `${Math.min(100, (row.value / maxV) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};
