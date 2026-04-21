"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * Dashboard widget: today + tomorrow pickups.
 *
 * Fetches /api/admin/upcoming-pickups and groups by bucket. Each row shows
 * pickup time, customer name, items, rush-fee badge if applicable, and a
 * link to the full order in /admin/orders.
 */

interface Reservation {
  pickup_at: string;
  square_order_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  items: Array<{ name?: string; variationId?: string; quantity: number }> | null;
  rush_fee_cents: number;
  status: string;
  notes: string | null;
}

interface Response {
  today: Reservation[];
  tomorrow: Reservation[];
  later: Reservation[];
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}

function summarize(items: Reservation["items"]): string {
  if (!items || items.length === 0) return "—";
  return items
    .map(i => `${i.name ?? i.variationId ?? "item"} ×${i.quantity}`)
    .join(", ");
}

function Section({ title, rows, emptyMsg }: { title: string; rows: Reservation[]; emptyMsg: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#f0e6de] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-bold text-[#5a3e36]">{title}</h3>
        <span className="text-xs text-[#b0a098]">{rows.length} pickup{rows.length === 1 ? "" : "s"}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[#b0a098] text-sm italic">{emptyMsg}</p>
      ) : (
        <ul className="divide-y divide-[#f0e6de]">
          {rows.map(r => (
            <li key={r.square_order_id} className="py-3 flex items-start gap-3">
              <div className="shrink-0 bg-[#FFF0F5] text-burgundy rounded-lg px-3 py-2 font-mono text-sm font-bold">
                {formatTime(r.pickup_at)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#5a3e36] flex items-center gap-2">
                  {r.customer_name || r.customer_email || "Guest"}
                  {r.rush_fee_cents > 0 && (
                    <span className="bg-[#843430] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      RUSH
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    r.status === "ready" ? "bg-green-100 text-green-700"
                    : r.status === "preparing" ? "bg-amber-100 text-amber-700"
                    : r.status === "picked_up" ? "bg-gray-100 text-gray-500"
                    : "bg-[#FFF5EE] text-[#7a6a62]"
                  }`}>
                    {r.status}
                  </span>
                </p>
                <p className="text-[#7a6a62] text-xs truncate">{summarize(r.items)}</p>
                {r.customer_phone && (
                  <p className="text-[#b0a098] text-xs mt-0.5">{r.customer_phone}</p>
                )}
              </div>
              <a
                href={`/admin/orders?focus=${encodeURIComponent(r.square_order_id)}`}
                className="shrink-0 text-xs text-[#843430] font-bold hover:underline"
              >
                Open →
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function UpcomingPickups() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminFetch("/api/admin/upcoming-pickups")
      .then(async r => {
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) { setError(j.error ?? "Load failed"); return; }
        setData(j);
      })
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-[#b0a098] text-sm">Loading upcoming pickups…</p>;
  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Section title="🔥 Today" rows={data.today} emptyMsg="No pickups today." />
      <Section title="🧁 Tomorrow" rows={data.tomorrow} emptyMsg="No pickups scheduled for tomorrow yet." />
    </div>
  );
}
