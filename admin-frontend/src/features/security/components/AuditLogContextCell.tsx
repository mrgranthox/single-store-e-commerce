import { auditMetadataPreviewLine, metadataToBusinessRows } from "@/features/security/lib/securityUiHelpers";

const summaryBtnClass =
  "cursor-pointer list-none text-[10px] font-bold uppercase tracking-wider text-[#1653cc] underline decoration-[#1653cc]/45 underline-offset-2 marker:hidden hover:text-[#0f3d99] [&::-webkit-details-marker]:hidden";

type Props = { metadata: unknown };

/** Table cell: one-line summary + expandable business field list (no JSON). */
export const AuditLogContextCell = ({ metadata }: Props) => {
  const preview = auditMetadataPreviewLine(metadata);
  const rows = metadataToBusinessRows(metadata, { maxRows: 16 });
  const hasExpand = rows.length > 0;

  if (preview === "—" && !hasExpand) {
    return <span className="text-xs text-[#9ca3af]">—</span>;
  }

  return (
    <div className="max-w-[220px] text-left sm:max-w-[280px]">
      <p className="line-clamp-2 text-xs leading-relaxed text-[#434654]" title={preview !== "—" ? preview : undefined}>
        {preview !== "—" ? preview : "Context available"}
      </p>
      {hasExpand ? (
        <details className="mt-1.5 group">
          <summary className={summaryBtnClass}>All fields ({rows.length})</summary>
          <dl className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-md border border-[#e8eaf4] bg-[#fafbff] p-2 text-left">
            {rows.map((r, i) => (
              <div key={`${r.label}-${i}`}>
                <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-[#737685]">{r.label}</dt>
                <dd className="break-words text-[11px] text-[#181b25]">{r.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
};
