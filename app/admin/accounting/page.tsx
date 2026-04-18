"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-fetch";

interface Order {
  id: string;
  createdAt: string;
  state: string;
  totalMoney: { amount: number } | null;
  lineItems: { name: string; quantity: string; totalMoney: { amount: number } | null }[];
  source: string | null;
}

interface ProductCost {
  square_catalog_id: string;
  cost_per_item_cents: number;
}

type Period = "7d" | "30d" | "90d" | "all";

export default function AccountingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30d");
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [ordersRes, costsRes] = await Promise.all([
        adminFetch("/api/square/orders"),
        supabase.from("product_enrichments").select("square_catalog_id, cost_per_item_cents"),
      ]);
      const ordersData = await ordersRes.json();
      if (ordersData.error) throw new Error(ordersData.error);
      setOrders(ordersData.orders || []);

      if (costsRes.data) {
        const map: Record<string, number> = {};
        costsRes.data.forEach((c: ProductCost) => { if (c.cost_per_item_cents) map[c.square_catalog_id] = c.cost_per_item_cents; });
        setCosts(map);
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load"); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter by period
  const now = Date.now();
  const periodMs: Record<Period, number> = { "7d": 7 * 86400000, "30d": 30 * 86400000, "90d": 90 * 86400000, "all": now };
  const filteredOrders = orders.filter((o) => {
    if (o.state !== "COMPLETED") return false;
    const orderTime = new Date(o.createdAt).getTime();
    return now - orderTime <= periodMs[period];
  });

  // Revenue
  const totalRevenue = filteredOrders.reduce((s, o) => s + (o.totalMoney?.amount || 0), 0);
  const orderCount = filteredOrders.length;
  const avgOrder = orderCount > 0 ? totalRevenue / orderCount : 0;

  // Items sold breakdown
  const itemBreakdown: Record<string, { quantity: number; revenue: number }> = {};
  filteredOrders.forEach((o) => {
    o.lineItems.forEach((li) => {
      const key = li.name || "Unknown";
      if (!itemBreakdown[key]) itemBreakdown[key] = { quantity: 0, revenue: 0 };
      itemBreakdown[key].quantity += parseInt(li.quantity) || 0;
      itemBreakdown[key].revenue += li.totalMoney?.amount || 0;
    });
  });
  const sortedItems = Object.entries(itemBreakdown).sort((a, b) => b[1].revenue - a[1].revenue);

  // Estimated costs (using avg cost if per-product not set)
  const avgCost = Object.values(costs).length > 0
    ? Object.values(costs).reduce((s, c) => s + c, 0) / Object.values(costs).length
    : 250; // default $2.50 if no costs set
  const totalItemsSold = sortedItems.reduce((s, [, v]) => s + v.quantity, 0);
  const estimatedCost = totalItemsSold * avgCost;
  const estimatedProfit = totalRevenue - estimatedCost;
  const profitMargin = totalRevenue > 0 ? (estimatedProfit / totalRevenue) * 100 : 0;

  // Revenue by source
  const sourceBreakdown: Record<string, number> = {};
  filteredOrders.forEach((o) => {
    const src = o.source || "In-Person POS";
    sourceBreakdown[src] = (sourceBreakdown[src] || 0) + (o.totalMoney?.amount || 0);
  });

  // Daily revenue for chart approximation
  const dailyRevenue: Record<string, number> = {};
  filteredOrders.forEach((o) => {
    const day = new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailyRevenue[day] = (dailyRevenue[day] || 0) + (o.totalMoney?.amount || 0);
  });
  const dailyEntries = Object.entries(dailyRevenue).slice(-14);
  const maxDaily = Math.max(...dailyEntries.map(([, v]) => v), 1);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#5a3e36]">Accounting</h2>
          <p className="text-[#b0a098] text-sm">Revenue, costs, and profit tracking</p>
        </div>
        <div className="flex gap-1 bg-[#FFF5EE] rounded-xl p-1">
          {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p ? "bg-white text-[#5a3e36] shadow-sm" : "text-[#b0a098] hover:text-[#7a6a62]"}`}>
              {p === "all" ? "All" : p}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-500 text-sm rounded-xl p-3 mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#E8A0BF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Top Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl p-5 border border-[#f0e6de] shadow-sm border-l-4 border-l-green-500">
              <p className="text-[#b0a098] text-xs font-semibold mb-1">Revenue</p>
              <p className="text-2xl font-bold text-[#5a3e36]">{formatPrice(totalRevenue)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-[#f0e6de] shadow-sm border-l-4 border-l-red-400">
              <p className="text-[#b0a098] text-xs font-semibold mb-1">Est. Costs</p>
              <p className="text-2xl font-bold text-[#5a3e36]">{formatPrice(estimatedCost)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-[#f0e6de] shadow-sm border-l-4 border-l-[#E8A0BF]">
              <p className="text-[#b0a098] text-xs font-semibold mb-1">Est. Profit</p>
              <p className={`text-2xl font-bold ${estimatedProfit >= 0 ? "text-green-600" : "text-red-500"}`}>{formatPrice(estimatedProfit)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-[#f0e6de] shadow-sm border-l-4 border-l-[#1976D2]">
              <p className="text-[#b0a098] text-xs font-semibold mb-1">Margin</p>
              <p className="text-2xl font-bold text-[#5a3e36]">{profitMargin.toFixed(1)}%</p>
            </div>
          </div>

          {/* Online vs In-Person Split */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🌐</span>
                <p className="text-[#b0a098] text-xs font-semibold">Online Orders</p>
              </div>
              <p className="text-xl font-bold text-[#5a3e36]">
                {formatPrice(filteredOrders.filter(o => o.source && o.source !== "Square Point of Sale").reduce((s, o) => s + (o.totalMoney?.amount || 0), 0))}
              </p>
              <p className="text-[#b0a098] text-xs mt-0.5">
                {filteredOrders.filter(o => o.source && o.source !== "Square Point of Sale").length} orders
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🏪</span>
                <p className="text-[#b0a098] text-xs font-semibold">In-Person POS</p>
              </div>
              <p className="text-xl font-bold text-[#5a3e36]">
                {formatPrice(filteredOrders.filter(o => !o.source || o.source === "Square Point of Sale").reduce((s, o) => s + (o.totalMoney?.amount || 0), 0))}
              </p>
              <p className="text-[#b0a098] text-xs mt-0.5">
                {filteredOrders.filter(o => !o.source || o.source === "Square Point of Sale").length} orders
              </p>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm">
              <p className="text-[#b0a098] text-xs font-semibold mb-1">Orders</p>
              <p className="text-xl font-bold text-[#5a3e36]">{orderCount}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm">
              <p className="text-[#b0a098] text-xs font-semibold mb-1">Avg Order</p>
              <p className="text-xl font-bold text-[#5a3e36]">{formatPrice(avgOrder)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm">
              <p className="text-[#b0a098] text-xs font-semibold mb-1">Items Sold</p>
              <p className="text-xl font-bold text-[#5a3e36]">{totalItemsSold}</p>
            </div>
          </div>

          {/* Revenue Chart (bar visualization) */}
          {dailyEntries.length > 0 && (
            <div className="bg-white rounded-xl p-5 border border-[#f0e6de] shadow-sm mb-6">
              <h3 className="text-[#5a3e36] font-semibold text-sm mb-4">Daily Revenue</h3>
              <div className="flex items-end gap-1.5 h-32">
                {dailyEntries.map(([day, val]) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-md bg-gradient-to-t from-[#E8A0BF] to-[#F0C0D4] transition-all hover:from-[#d889ad] hover:to-[#E8A0BF]"
                      style={{ height: `${(val / maxDaily) * 100}%`, minHeight: "4px" }}
                      title={`${day}: ${formatPrice(val)}`} />
                    <span className="text-[8px] text-[#b0a098] truncate w-full text-center">{day.split(" ")[1]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Breakdown */}
            <div className="bg-white rounded-xl p-5 border border-[#f0e6de] shadow-sm">
              <h3 className="text-[#5a3e36] font-semibold text-sm mb-4">Top Products</h3>
              {sortedItems.length === 0 ? (
                <p className="text-[#b0a098] text-sm">No sales data yet</p>
              ) : (
                <div className="space-y-3">
                  {sortedItems.slice(0, 8).map(([name, data]) => (
                    <div key={name} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-[#5a3e36] text-sm font-medium truncate">{name}</p>
                        <p className="text-[#b0a098] text-xs">{data.quantity} sold</p>
                      </div>
                      <span className="text-[#5a3e36] font-bold text-sm">{formatPrice(data.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Revenue by Source */}
            <div className="bg-white rounded-xl p-5 border border-[#f0e6de] shadow-sm">
              <h3 className="text-[#5a3e36] font-semibold text-sm mb-4">Revenue by Source</h3>
              {Object.entries(sourceBreakdown).length === 0 ? (
                <p className="text-[#b0a098] text-sm">No sales data yet</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]).map(([source, amount]) => (
                    <div key={source} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{source === "In-Person POS" ? "🏪" : "🌐"}</span>
                        <span className="text-[#5a3e36] text-sm font-medium">{source}</span>
                      </div>
                      <span className="text-[#5a3e36] font-bold text-sm">{formatPrice(amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cost Setup Notice */}
          {Object.keys(costs).length === 0 && (
            <div className="mt-6 bg-[#FFF5EE] rounded-xl p-4 border border-[#f0e6de] flex items-start gap-3">
              <span className="text-lg">💡</span>
              <div>
                <p className="text-[#5a3e36] text-sm font-semibold">Set your product costs for accurate profit tracking</p>
                <p className="text-[#b0a098] text-xs mt-1">Go to Products → click &quot;Details&quot; on any product → enter your &quot;Cost Per Item&quot;. This is what it costs you to make each item (ingredients + labor).</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
