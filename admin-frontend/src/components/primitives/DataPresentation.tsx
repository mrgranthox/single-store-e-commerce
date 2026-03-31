import type { ReactNode } from "react";
import { useMemo } from "react";

import { DataTableShell } from "@/components/primitives/DataTableShell";

const humanizeKey = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const ObjectFieldPreview = ({
  record,
  maxKeys = 40
}: {
  record: Record<string, unknown>;
  maxKeys?: number;
}) => {
  const keys = Object.keys(record);
  const shown = keys.slice(0, maxKeys);
  return (
    <div className="space-y-2">
      {keys.length > maxKeys ? (
        <p className="text-xs text-slate-500">
          Showing {maxKeys} of {keys.length} fields. The interchange section below includes the full record.
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {shown.map((key) => (
          <div key={key} className="rounded-md border border-slate-100 bg-[#f8f9fc] px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">{humanizeKey(key)}</div>
            <div className="mt-1 break-words text-sm text-[#181b25]">
              <UnknownValue value={record[key]} depth={0} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ArrayFieldPreview = ({ items, max = 25 }: { items: unknown[]; max?: number }) => {
  const shown = items.slice(0, max);
  return (
    <div className="space-y-2">
      {items.length > max ? (
        <p className="text-xs text-slate-500">
          Showing first {max} of {items.length} items. See interchange format below for the full list.
        </p>
      ) : null}
      <ul className="list-inside list-decimal space-y-1.5 text-sm text-slate-800">
        {shown.map((item, i) => (
          <li key={i} className="pl-1">
            <UnknownValue value={item} depth={0} />
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Collapsed serialized copy for pasting into tickets or tooling — not the primary view. */
export const SerializedInterchangeDetails = ({
  data,
  summaryLabel = "Interchange format (copy for support or tools)",
  preClassName = "max-h-48 overflow-auto border-t border-slate-200 bg-[#13161e] p-3 text-[11px] leading-relaxed text-slate-100"
}: {
  data: unknown;
  summaryLabel?: string;
  preClassName?: string;
}) => {
  const text = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  return (
    <details className="rounded-md border border-slate-200 bg-slate-50/90">
      <summary className="cursor-pointer select-none px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#737685]">
        {summaryLabel}
      </summary>
      <pre className={preClassName}>{text}</pre>
    </details>
  );
};

export const TechnicalJsonDisclosure = ({
  data,
  label = "Technical details",
  defaultOpen = false,
  summaryClassName
}: {
  data: unknown;
  label?: string;
  defaultOpen?: boolean;
  /** e.g. Stitch-style visible “View details” trigger */
  summaryClassName?: string;
}) => {
  return (
    <details
      className="rounded-lg border border-slate-200 bg-white shadow-sm"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary
        className={
          summaryClassName ??
          "cursor-pointer select-none px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#737685]"
        }
      >
        {label}
      </summary>
      <div className="border-t border-slate-100">
        <div className="space-y-3 p-4">
          {data === null || data === undefined ? (
            <p className="text-sm text-slate-500">No data.</p>
          ) : isPlainObject(data) ? (
            Object.keys(data).length === 0 ? (
              <p className="text-sm text-slate-500">Empty record.</p>
            ) : (
              <ObjectFieldPreview record={data} />
            )
          ) : Array.isArray(data) ? (
            data.length === 0 ? (
              <p className="text-sm text-slate-500">Empty list.</p>
            ) : (
              <ArrayFieldPreview items={data} />
            )
          ) : (
            <div className="text-sm text-slate-800">
              <UnknownValue value={data} depth={0} />
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 px-4 pb-4">
          <SerializedInterchangeDetails data={data} preClassName="max-h-72 overflow-auto border-t border-slate-200 bg-[#13161e] p-3 text-[11px] leading-relaxed text-slate-100" />
        </div>
      </div>
    </details>
  );
};

const formatMaybeDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value;
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
};

export const UnknownValue = ({
  value,
  depth = 0
}: {
  value: unknown;
  depth?: number;
}): ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-slate-400">—</span>;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "—";
  }
  if (typeof value === "string") {
    return formatMaybeDate(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-400">—</span>;
    }
    if (depth >= 2) {
      return <span className="text-slate-600">{value.length} items</span>;
    }
    return (
      <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-700">
        {value.slice(0, 8).map((item, i) => (
          <li key={i}>
            <UnknownValue value={item} depth={depth + 1} />
          </li>
        ))}
        {value.length > 8 ? <li className="text-xs text-slate-500">+{value.length - 8} more</li> : null}
      </ul>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (depth >= 2 || entries.length > 8) {
      return <TechnicalJsonDisclosure data={value} label="View nested data" />;
    }
    return (
      <div className="grid gap-1 rounded-md border border-slate-100 bg-[#f8f9fc] p-2 text-xs">
        {entries.map(([k, v]) => (
          <div key={k} className="flex flex-wrap gap-2">
            <span className="font-medium text-slate-500">{humanizeKey(k)}</span>
            <span className="text-slate-800">
              <UnknownValue value={v} depth={depth + 1} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  return String(value);
};

export const RecordFieldGrid = ({
  record,
  maxKeys = 48,
  title
}: {
  record: Record<string, unknown>;
  maxKeys?: number;
  title?: string;
}) => {
  const keys = Object.keys(record).slice(0, maxKeys);
  return (
    <div className="space-y-3">
      {title ? <h3 className="text-sm font-semibold text-[#181b25]">{title}</h3> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {keys.map((key) => (
          <div
            key={key}
            className="rounded-xl border border-slate-100 bg-[#f8f9fc] px-4 py-3 shadow-sm"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">{humanizeKey(key)}</div>
            <div className="mt-1 break-words text-sm text-[#181b25]">
              <UnknownValue value={record[key]} depth={0} />
            </div>
          </div>
        ))}
      </div>
      {Object.keys(record).length > maxKeys ? (
        <p className="text-xs text-slate-500">
          Showing {maxKeys} of {Object.keys(record).length} fields.
        </p>
      ) : null}
      <SerializedInterchangeDetails
        data={record}
        summaryLabel="Interchange format (full record for support or tools)"
        preClassName="max-h-72 overflow-auto border-t border-slate-200 bg-[#13161e] p-3 text-[11px] leading-relaxed text-slate-100"
      />
    </div>
  );
};

const buildTableFromItems = (items: unknown[]): { columns: string[]; rows: ReactNode[][] } | null => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  const first = items[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) {
    return null;
  }
  const keys = Object.keys(first as object).slice(0, 10);
  const columns = keys.map((k) => humanizeKey(k));
  const rows = items.slice(0, 100).map((row) => {
    const r = row as Record<string, unknown>;
    return keys.map((k) => <UnknownValue key={k} value={r[k]} depth={1} />);
  });
  return { columns, rows };
};

/** Renders API `data` / `meta` with tables and field grids first; serialized copy only when needed. */
export const AdminResponseBodyView = ({
  data,
  meta
}: {
  data: unknown;
  meta?: Record<string, unknown> | undefined;
}) => {
  if (data === null || data === undefined) {
    return <p className="text-sm text-slate-500">No data.</p>;
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;

    if (record.entity && typeof record.entity === "object" && !Array.isArray(record.entity)) {
      return (
        <div className="space-y-4">
          <RecordFieldGrid record={record.entity as Record<string, unknown>} title="Record" />
          {meta && Object.keys(meta).length > 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Pagination</p>
              <dl className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
                {typeof meta.page === "number" ? (
                  <div>
                    <dt className="text-xs text-slate-500">Page</dt>
                    <dd className="font-medium">{meta.page}</dd>
                  </div>
                ) : null}
                {typeof meta.totalItems === "number" ? (
                  <div>
                    <dt className="text-xs text-slate-500">Total</dt>
                    <dd className="font-medium">{meta.totalItems}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-3">
                <TechnicalJsonDisclosure data={meta} label="Pagination & query details" />
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    if (Array.isArray(record.items)) {
      const table = buildTableFromItems(record.items as unknown[]);
      if (table) {
        return (
          <div className="space-y-3">
            <DataTableShell columns={table.columns} rows={table.rows} emptyState="No items." />
            {meta ? (
              <p className="text-xs text-slate-500">
                {typeof meta.page === "number" ? `Page ${meta.page}` : null}
                {typeof meta.totalItems === "number" ? ` · ${meta.totalItems} total` : null}
              </p>
            ) : null}
          </div>
        );
      }
    }

    return (
      <div className="space-y-4">
        <RecordFieldGrid record={record} />
      </div>
    );
  }

  if (Array.isArray(data)) {
    const table = buildTableFromItems(data);
    if (table) {
      return <DataTableShell columns={table.columns} rows={table.rows} emptyState="No rows." />;
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        This result cannot be shown as a table. Open <span className="font-medium">Advanced details</span> for the full
        record.
      </p>
      <TechnicalJsonDisclosure
        data={{ data, meta }}
        label="Advanced details"
        defaultOpen={false}
      />
    </div>
  );
};
