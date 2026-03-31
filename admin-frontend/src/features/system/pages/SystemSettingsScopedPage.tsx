import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DataTableShell } from "@/components/primitives/DataTableShell";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { StitchGradientButton, StitchPageBody, StitchSecondaryButton } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { requestAdminStepUpToken } from "@/features/auth/step-up";
import {
  ApiError,
  listAdminSettingsScoped,
  patchAdminSettingsScoped,
  type SettingsScope,
  type SystemSettingRow
} from "@/features/system/api/admin-system.api";
import {
  ScopedSettingsStitchWorkspace,
  stitchBoundKeys
} from "@/features/system/components/ScopedSettingsStitchWorkspace";
import { humanizeSettingKey, summarizeSettingValue } from "@/features/system/lib/settingsValueSummary";

type SystemSettingsScopedPageProps = {
  scope: SettingsScope;
  title: string;
  description: string;
  eyebrow?: [string, string];
};

const formatRelative = (iso: string) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    return iso;
  }
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

export const SystemSettingsScopedPage = ({ scope, title, description, eyebrow }: SystemSettingsScopedPageProps) => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const actorEmail = useAdminAuthStore((s) => s.actor?.email ?? null);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SystemSettingRow | null>(null);
  const [draftJson, setDraftJson] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [initialJson, setInitialJson] = useState<string | null>(null);
  const [saveFlash, setSaveFlash] = useState<"success" | "error" | null>(null);

  const queryKey = useMemo(() => ["admin-settings-scoped", scope] as const, [scope]);

  const settingsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminSettingsScoped(accessToken, scope);
    },
    enabled: Boolean(accessToken)
  });

  const patchMut = useMutation({
    mutationFn: async (payload: { key: string; value: unknown }) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      const stepUpToken = await requestAdminStepUpToken({
        accessToken,
        email: actorEmail
      });
      return patchAdminSettingsScoped(accessToken, scope, [payload], stepUpToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setSaveFlash("success");
      window.setTimeout(() => setSaveFlash(null), 3500);
    },
    onError: () => {
      setSaveFlash("error");
      window.setTimeout(() => setSaveFlash(null), 5000);
    }
  });

  const items = settingsQuery.data?.data.items ?? [];
  const boundKeys = useMemo(() => stitchBoundKeys(scope), [scope]);
  const tableItems = useMemo(() => items.filter((row) => !boundKeys.has(row.key)), [items, boundKeys]);
  const hideTechnicalTable = scope === "checkout";

  const rows = useMemo(
    () =>
      tableItems.map((row) => [
        <button
          type="button"
          key={row.id}
          onClick={() => {
            setSelected(row);
            const j = JSON.stringify(row.value, null, 2);
            setDraftJson(j);
            setInitialJson(j);
            setParseError(null);
          }}
          className="text-left text-[13px] font-semibold text-[#1653cc] hover:underline"
        >
          {humanizeSettingKey(row.key)}
        </button>,
        <span key={`s-${row.id}`} className="text-[13px] text-[#374151]">
          {summarizeSettingValue(row.value)}
        </span>,
        <span key={`u-${row.id}`} className="text-xs text-[#737685]">
          {formatRelative(row.updatedAt)}
        </span>
      ]),
    [tableItems]
  );

  const errorMessage =
    settingsQuery.error instanceof ApiError
      ? settingsQuery.error.message
      : settingsQuery.error instanceof Error
        ? settingsQuery.error.message
        : null;

  const discard = () => {
    if (selected && initialJson !== null) {
      setDraftJson(initialJson);
      setParseError(null);
      return;
    }
    setSelected(null);
    setDraftJson("");
    setInitialJson(null);
    setParseError(null);
  };

  return (
    <StitchPageBody>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            {eyebrow ? (
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#737685]">
                <span className="text-[#1653cc]">{eyebrow[0]}</span>
                <span className="text-[#737685]">/</span>
                <span className="text-[#434654]">{eyebrow[1]}</span>
              </div>
            ) : null}
            <h1 className="font-headline text-2xl font-bold tracking-tight text-[#181b25] sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-[#434654]">{description}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap gap-3">
            <StitchSecondaryButton type="button" disabled={hideTechnicalTable} onClick={discard}>
              Discard Changes
            </StitchSecondaryButton>
            <StitchGradientButton
              type="button"
              disabled={hideTechnicalTable || !selected || patchMut.isPending}
              onClick={() => {
                if (!selected) {
                  return;
                }
                try {
                  const value = JSON.parse(draftJson) as unknown;
                  setParseError(null);
                  patchMut.mutate(
                    { key: selected.key, value },
                    {
                      onSuccess: () => {
                        setInitialJson(JSON.stringify(value, null, 2));
                      }
                    }
                  );
                } catch {
                  setParseError("Use valid structured text (JSON).");
                }
              }}
            >
              Save Changes
            </StitchGradientButton>
            </div>
            {hideTechnicalTable ? (
              <p className="max-w-md text-right text-[11px] text-[#737685]">
                Checkout settings save automatically when you change a control above.
              </p>
            ) : null}
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
        ) : null}

        {saveFlash === "success" ? (
          <div
            role="status"
            className="rounded-sm border border-[#00873b]/30 bg-[#f7fff3] px-4 py-3 text-sm font-semibold text-[#006b2d]"
          >
            Changes saved. Settings are live for this scope.
          </div>
        ) : null}
        {saveFlash === "error" ? (
          <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            Save failed. Check your permissions and try again.
          </div>
        ) : null}

        {!settingsQuery.isLoading ? (
          <ScopedSettingsStitchWorkspace
            key={settingsQuery.dataUpdatedAt}
            scope={scope}
            items={items}
            patching={patchMut.isPending}
            onPatch={(shortKey, value) => {
              patchMut.mutate({ key: shortKey, value });
            }}
          />
        ) : null}

        {settingsQuery.isLoading ? (
          <p className="text-sm text-[#737685]">Loading…</p>
        ) : hideTechnicalTable ? null : (
          <div className="overflow-hidden rounded-sm border border-[#e0e2f0]/40 bg-white shadow-sm">
            <DataTableShell
              variant="stitchOperational"
              embedded
              columns={["Setting", "Current value", "Last updated"]}
              rows={rows}
              rowKeys={tableItems.map((r) => r.id)}
              emptyState={
                tableItems.length === 0 && items.length > 0
                  ? "All settings in this scope use the workspace controls above."
                  : "No settings in this scope."
              }
            />
          </div>
        )}

        {selected && !hideTechnicalTable ? (
          <SurfaceCard title={`Edit · ${humanizeSettingKey(selected.key)}`}>
            <p className="mb-3 text-sm text-[#374151]">
              Summary: <span className="font-medium text-[#181b25]">{summarizeSettingValue(selected.value)}</span>
            </p>
            <details className="mb-3 rounded-lg border border-slate-200 bg-[#f8f9fb]">
              <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#737685]">
                Edit as structured text
              </summary>
              <div className="border-t border-slate-200 p-3">
                <textarea
                  value={draftJson}
                  onChange={(e) => {
                    setDraftJson(e.target.value);
                    setParseError(null);
                  }}
                  rows={10}
                  className="w-full rounded-lg border border-[#e5e7eb] bg-[#13161e] p-3 font-mono text-xs text-slate-100"
                />
              </div>
            </details>
            {parseError ? <p className="mb-2 text-sm text-red-700">{parseError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={patchMut.isPending}
                onClick={() => {
                  try {
                    const value = JSON.parse(draftJson) as unknown;
                    setParseError(null);
                    patchMut.mutate(
                      { key: selected.key, value },
                      {
                        onSuccess: () => {
                          setInitialJson(JSON.stringify(value, null, 2));
                        }
                      }
                    );
                  } catch {
                    setParseError("Use valid structured text (JSON).");
                  }
                }}
                className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold">
                Close
              </button>
            </div>
            <div className="mt-4">
              <TechnicalJsonDisclosure data={selected.value} label="Stored value (read-only snapshot)" defaultOpen={false} />
            </div>
          </SurfaceCard>
        ) : null}
      </div>
    </StitchPageBody>
  );
};
