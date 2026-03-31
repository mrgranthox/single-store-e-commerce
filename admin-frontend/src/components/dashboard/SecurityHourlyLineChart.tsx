/**
 * Stitch Screen 10 — events per hour (24h), line + red threshold at 65% of peak.
 */
export const SecurityHourlyLineChart = ({
  counts,
  valueLabel = "events"
}: {
  counts: number[];
  valueLabel?: string;
}) => {
  const w = 640;
  const h = 200;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 20;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxC = Math.max(...counts, 1);
  const thresholdY = padT + innerH * 0.35;
  const n = counts.length;
  const step = n <= 1 ? innerW : innerW / (n - 1);
  const pts = counts.map((c, i) => ({
    x: padL + i * step,
    y: padT + innerH - (c / maxC) * innerH,
    c,
    i
  }));
  const lineD = pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <svg
      className="h-auto w-full max-w-full"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Security ${valueLabel} per hour, last 24 hours, line chart with alert threshold`}
    >
      <line
        x1={padL}
        x2={w - padR}
        y1={thresholdY}
        y2={thresholdY}
        stroke="#ba1a1a"
        strokeWidth={1}
        strokeDasharray="4 3"
        opacity={0.85}
      />
      <path
        d={lineD}
        fill="none"
        stroke="#ba1a1a"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
      {pts.map((p) => (
        <circle key={p.i} cx={p.x} cy={p.y} r={2.5} fill="#ba1a1a" opacity={0.85}>
          <title>{`Hour ${p.i + 1}/24 — ${p.c} ${valueLabel}`}</title>
        </circle>
      ))}
    </svg>
  );
};
