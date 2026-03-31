/**
 * Visually hidden data table for screen readers alongside bar/column charts.
 */
export const TimeSeriesA11yTable = ({
  caption,
  valueColumnHeader,
  rows
}: {
  caption: string;
  valueColumnHeader: string;
  rows: Array<{ date: string; value: string; detail?: string }>;
}) => {
  if (rows.length === 0) return null;
  const hasDetail = rows.some((r) => r.detail);
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">{valueColumnHeader}</th>
          {hasDetail ? <th scope="col">Notes</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.date}>
            <td>{r.date}</td>
            <td>{r.value}</td>
            {hasDetail ? <td>{r.detail ?? "—"}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
