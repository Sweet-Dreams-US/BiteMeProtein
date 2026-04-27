"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * ShippingLabelPanel — admin-side label printing UI.
 *
 * Lives inside the order detail panel for shipping orders. Two visual states:
 *
 *   1. NO LABEL YET — parcel inputs (weight + LWH) and a "Get rates"
 *      button. Once rates land, a list of carrier/service options with
 *      per-row "Buy" buttons.
 *
 *   2. ALREADY LABELED — tracking number, "Open label PDF" button,
 *      "Resend customer email" button. Buying a new label is intentionally
 *      blocked at the API level too — see /shipping-label/buy route.
 *
 * The component fetches its own fulfillment row on mount so it doesn't
 * depend on the parent's state shape (ditto how ProductImageManager works).
 */

const DEFAULTS = {
  weightOz: 16,
  lengthIn: 8,
  widthIn: 6,
  heightIn: 4,
};

interface Rate {
  id: string;
  carrier: string;
  service: string;
  priceCents: number;
  deliveryDays: number | null;
  deliveryDate: string | null;
  guaranteed: boolean;
}

interface FulfillmentRow {
  tracking_number: string | null;
  carrier: string | null;
  service: string | null;
  label_url: string | null;
  label_cost_cents: number | null;
  easypost_shipment_id: string | null;
  shipped_at: string | null;
}

interface Props {
  orderId: string;
  /** Called after a successful buy so the parent can refresh the orders list. */
  onLabelBought?: () => void;
}

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ShippingLabelPanel({ orderId, onLabelBought }: Props) {
  const [fulfillment, setFulfillment] = useState<FulfillmentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Parcel inputs — defaulted but admin always confirms before requesting
  // a real rate quote. Numbers are kept as strings to avoid the
  // "0 vs empty input" pain.
  const [weightOz, setWeightOz] = useState(String(DEFAULTS.weightOz));
  const [lengthIn, setLengthIn] = useState(String(DEFAULTS.lengthIn));
  const [widthIn, setWidthIn] = useState(String(DEFAULTS.widthIn));
  const [heightIn, setHeightIn] = useState(String(DEFAULTS.heightIn));

  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [rates, setRates] = useState<Rate[]>([]);
  const [fetchingRates, setFetchingRates] = useState(false);

  const [buyingRateId, setBuyingRateId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: queryErr } = await supabase
      .from("order_fulfillment")
      .select("tracking_number, carrier, service, label_url, label_cost_cents, easypost_shipment_id, shipped_at")
      .eq("square_order_id", orderId)
      .maybeSingle();
    if (queryErr) setError(queryErr.message);
    setFulfillment(data as FulfillmentRow | null);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const getRates = async () => {
    setFetchingRates(true);
    setError("");
    setRates([]);
    try {
      const res = await adminFetch(`/api/admin/orders/${orderId}/shipping-label/rates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weightOz: parseFloat(weightOz),
          lengthIn: parseFloat(lengthIn),
          widthIn: parseFloat(widthIn),
          heightIn: parseFloat(heightIn),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to fetch rates");
      setShipmentId(json.shipmentId);
      // Cheapest first — admin almost always picks the cheapest unless
      // they need a specific carrier or guaranteed-by-date service.
      const sorted = (json.rates as Rate[]).slice().sort((a, b) => a.priceCents - b.priceCents);
      setRates(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rates");
    }
    setFetchingRates(false);
  };

  const buyRate = async (rate: Rate) => {
    if (!shipmentId) return;
    if (!confirm(`Buy ${rate.carrier} ${rate.service} for ${formatCents(rate.priceCents)}? This charges your EasyPost account.`)) {
      return;
    }
    setBuyingRateId(rate.id);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/orders/${orderId}/shipping-label/buy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rateId: rate.id,
          shipmentId,
          service: `${rate.carrier} ${rate.service}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to buy label");

      // Reload fulfillment row to flip into the "already labeled" state.
      await load();
      setRates([]);
      setShipmentId(null);
      onLabelBought?.();

      // Auto-open the label PDF in a new tab so Haley can print immediately.
      if (json.labelUrl) window.open(json.labelUrl, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to buy label");
    }
    setBuyingRateId(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <p className="text-[#b0a098] text-xs italic">Checking label status…</p>;
  }

  // Already labeled — show tracking + reprint
  if (fulfillment?.tracking_number && fulfillment?.label_url) {
    return (
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h4 className="text-[#5a3e36] font-semibold text-sm">📦 Shipping label</h4>
          <span className="text-green-600 text-[11px] font-bold uppercase tracking-wider">✓ Bought</span>
        </div>
        <div className="bg-[#FFF5EE] border border-[#f0e6de] rounded-xl p-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[#7a6a62]">Carrier</span>
            <span className="text-[#5a3e36] font-semibold">{fulfillment.service ?? fulfillment.carrier ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7a6a62]">Tracking</span>
            <span className="text-[#5a3e36] font-mono text-[11px]">{fulfillment.tracking_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7a6a62]">Cost</span>
            <span className="text-[#5a3e36] font-semibold">{formatCents(fulfillment.label_cost_cents)}</span>
          </div>
          {fulfillment.shipped_at && (
            <div className="flex justify-between">
              <span className="text-[#7a6a62]">Bought at</span>
              <span className="text-[#5a3e36]">{new Date(fulfillment.shipped_at).toLocaleString("en-US")}</span>
            </div>
          )}
        </div>
        <a
          href={fulfillment.label_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center bg-[#843430] text-white py-2.5 rounded-xl text-xs font-bold hover:bg-[#6e2a27]"
        >
          🖨️ Open label PDF
        </a>
        <p className="text-[10px] text-[#b0a098] italic text-center">
          Customer was emailed tracking automatically.
        </p>
      </div>
    );
  }

  // No label yet — show parcel inputs + rate flow
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-[#5a3e36] font-semibold text-sm">📦 Print shipping label</h4>
        <span className="text-[#b0a098] text-[10px]">EasyPost</span>
      </div>

      {error && (
        <p className="text-red-500 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {rates.length === 0 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Weight (oz)" value={weightOz} onChange={setWeightOz} />
            <NumberField label="Length (in)" value={lengthIn} onChange={setLengthIn} />
            <NumberField label="Width (in)" value={widthIn} onChange={setWidthIn} />
            <NumberField label="Height (in)" value={heightIn} onChange={setHeightIn} />
          </div>
          <button
            onClick={getRates}
            disabled={fetchingRates}
            className="w-full bg-[#E8A0BF] text-white py-2.5 rounded-xl text-xs font-bold hover:bg-[#d889ad] disabled:opacity-50"
          >
            {fetchingRates ? "Fetching rates…" : "Get rates"}
          </button>
        </>
      )}

      {rates.length > 0 && (
        <div className="space-y-2">
          <p className="text-[#7a6a62] text-[11px] font-semibold uppercase tracking-wider">Available rates (cheapest first)</p>
          <ul className="space-y-1.5">
            {rates.map((r) => (
              <li
                key={r.id}
                className="bg-white border border-[#f0e6de] rounded-xl p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[#5a3e36] font-semibold text-sm truncate">
                    {r.carrier} <span className="text-[#7a6a62] font-normal">{r.service}</span>
                  </p>
                  <p className="text-[10px] text-[#b0a098]">
                    {r.deliveryDays != null ? `${r.deliveryDays} day${r.deliveryDays === 1 ? "" : "s"}` : "Time varies"}
                    {r.guaranteed ? " · guaranteed" : ""}
                  </p>
                </div>
                <span className="text-[#5a3e36] font-bold text-sm shrink-0">{formatCents(r.priceCents)}</span>
                <button
                  onClick={() => buyRate(r)}
                  disabled={buyingRateId !== null}
                  className="shrink-0 bg-[#843430] text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-[#6e2a27] disabled:opacity-50"
                >
                  {buyingRateId === r.id ? "Buying…" : "Buy"}
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => { setRates([]); setShipmentId(null); }}
            disabled={buyingRateId !== null}
            className="w-full text-[11px] text-[#7a6a62] hover:text-[#5a3e36] py-1"
          >
            ← Edit parcel size
          </button>
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[#7a6a62] text-[10px] font-semibold uppercase tracking-wider mb-1">{label}</label>
      <input
        type="number"
        step="0.1"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-white border border-[#e8ddd4] rounded-lg text-sm text-[#5a3e36] focus:outline-none focus:border-[#E8A0BF]"
      />
    </div>
  );
}
