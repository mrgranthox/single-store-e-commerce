/**
 * Stitch Screen 7 — grouped bars: gross (primary blue) + net (#94a3b8 secondary) per day.
 */
export const GrossNetBarChart = ({
  points,
  formatValue
}: {
  points: Array<{ date: string; grossCents: number; netCents: number }>;
  formatValue: (cents: number) => string;
}) => {
  if (points.length === 0) return null;
  const maxY = Math.max(...points.flatMap((p) => [p.grossCents, p.netCents]), 1);
  return (
    <div className="-mx-3 flex h-64 min-w-[min(100%,560px)] items-end justify-between gap-0.5 overflow-x-auto px-3 sm:mx-0 sm:px-1">
      {points.map((p) => {
        const gh = Math.max(Math.round((p.grossCents / maxY) * 100), p.grossCents > 0 ? 8 : 2);
        const nh = Math.max(Math.round((p.netCents / maxY) * 100), p.netCents > 0 ? 8 : 2);
        return (
          <div key={p.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5">
            <div className="flex h-full w-full max-w-[28px] items-end justify-center gap-0.5">
              <div
                className="w-[42%] rounded-t-sm bg-[#1653cc]/85 shadow-sm"
                style={{ height: `${gh}%` }}
                title={`Gross ${formatValue(p.grossCents)} · ${p.date}`}
              />
              <div
                className="w-[42%] rounded-t-sm bg-[#94a3b8]"
                style={{ height: `${nh}%` }}
                title={`Net ${formatValue(p.netCents)} · ${p.date}`}
              />
            </div>
            <span className="mt-1 font-mono text-[8px] text-[#94a3b8]">{p.date.slice(5).replace("-", "/")}</span>
          </div>
        );
      })}
    </div>
  );
};
