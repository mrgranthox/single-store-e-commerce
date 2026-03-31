import { metadataToBusinessRows } from "@/features/security/lib/securityUiHelpers";

type Props = {
  metadata: unknown;
  title?: string;
  subtitle?: string;
  excludeKeys?: string[];
  className?: string;
};

/**
 * Business-facing context from structured metadata — no raw JSON.
 */
export const BusinessMetadataSection = ({
  metadata,
  title = "Additional context",
  subtitle,
  excludeKeys,
  className = ""
}: Props) => {
  const rows = metadataToBusinessRows(metadata, { excludeKeys });
  if (rows.length === 0) {
    return null;
  }
  return (
    <section className={`rounded-sm border border-[#e8eaf4] bg-white p-6 shadow-sm ${className}`.trim()}>
      <h2 className={`text-[0.6875rem] font-bold uppercase tracking-widest text-[#737685] ${subtitle ? "mb-1" : "mb-4"}`}>
        {title}
      </h2>
      {subtitle ? <p className="mb-4 text-xs text-[#737685]">{subtitle}</p> : null}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="min-w-0 border-b border-[#f1f3f9] pb-3 last:border-b-0 sm:border-b sm:pb-3">
            <dt className="text-[0.65rem] font-bold uppercase tracking-wider text-[#737685]">{r.label}</dt>
            <dd className="mt-1 break-words text-sm leading-snug text-[#181b25]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
