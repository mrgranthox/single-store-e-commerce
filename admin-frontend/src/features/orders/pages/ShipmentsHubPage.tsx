import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/primitives/PageHeader";

/** Accepts UUIDs and other backend-issued ids; unsafe path characters rejected. */
const shipmentIdAcceptable = (raw: string) => {
  const s = raw.trim();
  if (!s || s.length > 200) {
    return false;
  }
  if (/[\s#?]/.test(s) || s.includes("/") || s.includes("\\")) {
    return false;
  }
  return true;
};

export const ShipmentsHubPage = () => {
  const [id, setId] = useState("");
  const navigate = useNavigate();

  const goDetail = (ev?: FormEvent) => {
    ev?.preventDefault();
    const s = id.trim();
    if (!s) {
      return;
    }
    navigate(`/admin/shipments/${encodeURIComponent(s)}`);
  };

  const goTracking = () => {
    const s = id.trim();
    if (!s) {
      return;
    }
    navigate(`/admin/shipments/${encodeURIComponent(s)}/tracking`);
  };

  const valid = shipmentIdAcceptable(id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Shipments"
        titleSize="deck"
        description="Open shipment detail or tracking by id. Use fulfillment or dispatch queues to discover shipment ids from live orders."
      />

      <form
        onSubmit={goDetail}
        className="max-w-xl space-y-4 rounded-xl border border-[#e0e2f0] bg-white p-6 shadow-sm"
      >
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#737685]">
          Shipment id
          <input
            value={id}
            onChange={(ev) => setId(ev.target.value)}
            placeholder="Shipment ID"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
            autoComplete="off"
          />
        </label>
        {id.trim() && !valid ? (
          <p className="text-xs text-amber-800">Enter a shipment ID (up to 200 characters, no slashes or spaces).</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!valid}
            className="rounded-lg bg-[#1653cc] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
          >
            Shipment detail
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={goTracking}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 disabled:opacity-40"
          >
            Tracking events
          </button>
        </div>
      </form>

      <div className="text-sm text-[#434654]">
        <p className="font-semibold text-[#181b25]">Find shipments from queues</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <Link className="text-[#1653cc] hover:underline" to="/admin/orders/dispatch-queue">
              Dispatch queue
            </Link>
          </li>
          <li>
            <Link className="text-[#1653cc] hover:underline" to="/admin/orders/fulfillment-queue">
              Fulfillment queue
            </Link>
          </li>
          <li>
            <Link className="text-[#1653cc] hover:underline" to="/admin/orders">
              Orders list
            </Link>{" "}
            → order detail → shipment link
          </li>
        </ul>
      </div>
    </div>
  );
};
