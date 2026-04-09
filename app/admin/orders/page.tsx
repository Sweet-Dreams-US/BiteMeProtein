"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface OrderLineItem {
  name: string;
  quantity: string;
  totalMoney: { amount: number; currency: string } | null;
}

interface Order {
  id: string;
  createdAt: string;
  state: string;
  totalMoney: { amount: number; currency: string } | null;
  lineItems: OrderLineItem[];
  fulfillments: { type: string; state: string }[];
  source: string | null;
}

interface Fulfillment {
  id: string;
  square_order_id: string;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  shipped_at: string | null;
}

type FilterTab = "all" | "new" | "preparing" | "shipped" | "completed";

const statusColors: Record<string, string> = {
  new: "bg-[#E3F2FD] text-[#1976D2]",
  preparing: "bg-orange-50 text-orange-500",
  shipped: "bg-purple-50 text-purple-600",
  delivered: "bg-green-50 text-green-600",
  COMPLETED: "bg-green-50 text-green-600",
  OPEN: "bg-[#E3F2FD] text-[#1976D2]",
  CANCELED: "bg-red-50 text-red-500",
};

const statusLabels: Record<string, string> = {
  new: "New",
  preparing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [fulfillments, setFulfillments] = useState<Record<string, Fulfillment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [saving, setSaving] = useState(false);

  // Fulfillment edit state
  const [editStatus, setEditStatus] = useState("");
  const [editTracking, setEditTracking] = useState("");
  const [editCarrier, setEditCarrier] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [ordersRes, fulfillRes] = await Promise.all([
        fetch("/api/square/orders"),
        supabase.from("order_fulfillment").select("*"),
      ]);
      const ordersData = await ordersRes.json();
      if (ordersData.error) throw new Error(ordersData.error);
      setOrders(ordersData.orders || []);

      if (fulfillRes.data) {
        const map: Record<string, Fulfillment> = {};
        fulfillRes.data.forEach((f: Fulfillment) => { map[f.square_order_id] = f; });
        setFulfillments(map);
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load"); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    const f = fulfillments[order.id];
    setEditStatus(f?.status || "new");
    setEditTracking(f?.tracking_number || "");
    setEditCarrier(f?.carrier || "");
    setEditNotes(f?.notes || "");
  };

  const saveFulfillment = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    const existing = fulfillments[selectedOrder.id];
    const data = {
      square_order_id: selectedOrder.id,
      status: editStatus,
      tracking_number: editTracking || null,
      carrier: editCarrier || null,
      notes: editNotes || null,
      shipped_at: editStatus === "shipped" && !existing?.shipped_at ? new Date().toISOString() : existing?.shipped_at || null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from("order_fulfillment").update(data).eq("id", existing.id);
    } else {
      await supabase.from("order_fulfillment").insert(data);
    }

    setSaving(false);
    setSelectedOrder(null);
    fetchOrders();
  };

  const getOrderStatus = (order: Order): string => {
    const f = fulfillments[order.id];
    if (f) return f.status;
    if (order.state === "COMPLETED") return "new";
    return order.state.toLowerCase();
  };

  const formatPrice = (amount: number) => `$${(amount / 100).toFixed(2)}`;
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  // Filter orders
  const completedOrders = orders.filter((o) => o.state === "COMPLETED");
  const filteredOrders = filterTab === "all"
    ? completedOrders
    : completedOrders.filter((o) => getOrderStatus(o) === filterTab);

  // Stats
  const onlineOrders = completedOrders.filter((o) => o.source && o.source !== "Square Point of Sale");
  const inPersonOrders = completedOrders.filter((o) => !o.source || o.source === "Square Point of Sale");
  const newOrders = completedOrders.filter((o) => getOrderStatus(o) === "new");

  const inputClass = "w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-2.5 text-[#5a3e36] text-sm placeholder:text-[#c4b5aa] focus:border-[#E8A0BF] focus:ring-1 focus:ring-[#E8A0BF] focus:outline-none";

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#5a3e36]">Orders & Fulfillment</h2>
          <p className="text-[#b0a098] text-sm">Track, fulfill, and ship orders</p>
        </div>
        <button onClick={fetchOrders} className="border border-[#e8ddd4] text-[#7a6a62] hover:text-[#5a3e36] px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          Refresh
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-500 text-sm rounded-xl p-3 mb-4">{error}</div>}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm border-l-4 border-l-[#1976D2]">
          <p className="text-[#b0a098] text-xs font-semibold mb-1">Needs Fulfillment</p>
          <p className="text-2xl font-bold text-[#1976D2]">{newOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm border-l-4 border-l-green-500">
          <p className="text-[#b0a098] text-xs font-semibold mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-[#5a3e36]">{completedOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm border-l-4 border-l-[#E8A0BF]">
          <p className="text-[#b0a098] text-xs font-semibold mb-1">🌐 Online</p>
          <p className="text-2xl font-bold text-[#5a3e36]">{onlineOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm border-l-4 border-l-orange-400">
          <p className="text-[#b0a098] text-xs font-semibold mb-1">🏪 In-Person</p>
          <p className="text-2xl font-bold text-[#5a3e36]">{inPersonOrders.length}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-[#f0e6de] mb-5 overflow-x-auto">
        {(["all", "new", "preparing", "shipped", "completed"] as FilterTab[]).map((tab) => (
          <button key={tab} onClick={() => setFilterTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${
              filterTab === tab ? "bg-[#E8A0BF] text-white" : "text-[#b0a098] hover:text-[#5a3e36] hover:bg-[#FFF5EE]"
            }`}>
            {tab === "all" ? `All (${completedOrders.length})` : `${tab} (${completedOrders.filter((o) => getOrderStatus(o) === tab).length})`}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#E8A0BF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#f0e6de]">
          <p className="text-[#7a6a62] mb-1">No orders in this category</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((order) => {
            const status = getOrderStatus(order);
            const f = fulfillments[order.id];
            const isOnline = order.source && order.source !== "Square Point of Sale";
            return (
              <div key={order.id} onClick={() => openOrderDetail(order)}
                className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm hover:shadow-md hover:border-[#E8A0BF]/30 transition-all cursor-pointer">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-[#5a3e36] font-mono text-sm font-bold">#{order.id.slice(-6).toUpperCase()}</span>
                    <span className="text-base">{isOnline ? "🌐" : "🏪"}</span>
                    <span className="text-[#b0a098] text-xs hidden md:block">{formatDate(order.createdAt)}</span>
                    <span className="text-[#b0a098] text-xs hidden lg:block">
                      {order.lineItems.length} item{order.lineItems.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {f?.tracking_number && <span className="text-purple-500 text-[10px] font-bold">📦 Tracked</span>}
                    <span className="text-[#5a3e36] font-bold text-sm">
                      {order.totalMoney ? formatPrice(order.totalMoney.amount) : "—"}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${statusColors[status] || "bg-[#FFF5EE] text-[#b0a098]"}`}>
                      {statusLabels[status] || status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== ORDER DETAIL + FULFILLMENT MODAL ===== */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl border border-[#f0e6de] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="p-6 border-b border-[#f0e6de]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[#5a3e36] text-lg font-bold">Order #{selectedOrder.id.slice(-6).toUpperCase()}</h3>
                  <p className="text-[#b0a098] text-xs">{formatDate(selectedOrder.createdAt)}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 rounded-full bg-[#FFF5EE] flex items-center justify-center text-[#b0a098]">✕</button>
              </div>
            </div>

            {/* Order Info */}
            <div className="p-6 space-y-4">
              {/* Source */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-base">{selectedOrder.source && selectedOrder.source !== "Square Point of Sale" ? "🌐" : "🏪"}</span>
                <span className="text-[#5a3e36] font-medium">{selectedOrder.source || "In-Person POS"}</span>
              </div>

              {/* Items */}
              <div>
                <p className="text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-1.5">
                  {selectedOrder.lineItems.map((li, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#FFF5EE] rounded-lg p-3">
                      <div>
                        <span className="text-[#5a3e36] text-sm font-medium">{li.name}</span>
                        <span className="text-[#b0a098] text-sm ml-2">×{li.quantity}</span>
                      </div>
                      <span className="text-[#5a3e36] font-semibold text-sm">
                        {li.totalMoney ? formatPrice(li.totalMoney.amount) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-3 pt-3 border-t border-[#f0e6de]">
                  <span className="text-[#5a3e36] font-bold">Total</span>
                  <span className="text-[#5a3e36] text-xl font-bold">
                    {selectedOrder.totalMoney ? formatPrice(selectedOrder.totalMoney.amount) : "—"}
                  </span>
                </div>
              </div>

              {/* Fulfillment Section */}
              <div className="border-t border-[#f0e6de] pt-4">
                <p className="text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-3">Fulfillment</p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-1.5">Status</label>
                    <div className="flex gap-1.5">
                      {["new", "preparing", "shipped", "delivered"].map((s) => (
                        <button key={s} onClick={() => setEditStatus(s)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                            editStatus === s ? `${statusColors[s]}` : "bg-[#FFF5EE] text-[#b0a098] hover:text-[#7a6a62]"
                          }`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(editStatus === "shipped" || editStatus === "delivered") && (
                    <>
                      <div>
                        <label className="block text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-1.5">Carrier</label>
                        <select value={editCarrier} onChange={(e) => setEditCarrier(e.target.value)} className={inputClass}>
                          <option value="">Select carrier</option>
                          <option value="USPS">USPS</option>
                          <option value="UPS">UPS</option>
                          <option value="FedEx">FedEx</option>
                          <option value="DHL">DHL</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-1.5">Tracking Number</label>
                        <input type="text" value={editTracking} onChange={(e) => setEditTracking(e.target.value)} className={inputClass} placeholder="Enter tracking number" />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-1.5">Notes</label>
                    <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className={inputClass} placeholder="Internal notes about this order..." />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button onClick={saveFulfillment} disabled={saving}
                  className="w-full bg-[#E8A0BF] text-white py-3 rounded-xl font-bold hover:bg-[#d889ad] disabled:opacity-50">
                  {saving ? "Saving..." : "Save Fulfillment"}
                </button>

                {/* Square Dashboard link */}
                <a href={`https://squareup.com/dashboard/orders/overview/${selectedOrder.id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="block w-full text-center border border-[#e8ddd4] text-[#7a6a62] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#FFF5EE] transition-colors">
                  Open in Square Dashboard →
                </a>

                <p className="text-[#b0a098] text-[10px] text-center">
                  Print shipping labels from Square Dashboard → Fulfillment → Ship
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
