"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-fetch";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LineItem {
  id: string;
  name: string | null;
  quantity: string | null;
  base_price_cents: number | null;
  variation_name: string | null;
}

interface Order {
  id: string;
  created_at: string;
  state: string | null;
  total_money_cents: number | null;
  source_name: string | null;
  customer_id: string | null;
  raw: any;
  event_id: string | null;
  line_items?: LineItem[];
  customer?: { email: string | null; phone: string | null; given_name: string | null; family_name: string | null } | null;
  event?: { id: string; title: string; date: string } | null;
}

interface EventOption {
  id: string;
  title: string;
  date: string;
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

type SourceFilter = "all" | "online" | "in-person";
type DateFilter = "today" | "7d" | "30d" | "90d" | "all";
type StatusFilter = "all" | "new" | "preparing" | "shipped" | "delivered";
type FulfillmentFilter = "all" | "pickup" | "shipping";
type RefundFilter = "all" | "hide-refunded" | "only-refunded";

const statusColors: Record<string, string> = {
  new: "bg-[#E3F2FD] text-[#1976D2]",
  preparing: "bg-orange-50 text-orange-500",
  shipped: "bg-purple-50 text-purple-600",
  delivered: "bg-green-50 text-green-600",
  COMPLETED: "bg-green-50 text-green-600",
  OPEN: "bg-[#E3F2FD] text-[#1976D2]",
  CANCELED: "bg-red-50 text-red-500",
};

// POS sales share the "new" DB status but should be visually distinct —
// they're history, not a work queue. Green = done, like COMPLETED.
const posBadgeColor = "bg-green-50/70 text-green-700";

const dateFilterToIso = (f: DateFilter): string | null => {
  if (f === "all") return null;
  const now = Date.now();
  const d = f === "today" ? 1 : f === "7d" ? 7 : f === "30d" ? 30 : 90;
  return new Date(now - d * 24 * 60 * 60 * 1000).toISOString();
};

const isOnlineSource = (src: string | null): boolean =>
  !!src && src !== "Square Point of Sale" && src !== "Point of Sale";

// Detect pickup orders from the raw Square response. Square stores
// fulfillment type at raw.fulfillments[].type; we check both shapes because
// webhook events nest differently (event.data.object.order vs the order
// object itself).
const isPickupOrder = (order: Order): boolean => {
  const fulfillments = order.raw?.fulfillments ?? order.raw?.order?.fulfillments ?? [];
  return Array.isArray(fulfillments)
    && fulfillments.some((f: { type?: string }) => f?.type === "PICKUP");
};

// Display label for a workflow status. DB keys stay constant (new /
// preparing / shipped / delivered) so filters, reports, and automation
// keep working; the UI rebranding happens here.
//
//   - In-person POS orders bypass the workflow entirely — the customer
//     already walked away with the item at the register. Showing "new"
//     on those is misleading. Label as "POS sale".
//   - Pickup orders use bakery language (baking / ready / picked up).
//   - Shipping orders use carrier language (preparing / shipped / delivered).
const isInPersonOrder = (order: Order): boolean =>
  !isOnlineSource(order.source_name);

const statusLabel = (order: Order, status: string): string => {
  if (isInPersonOrder(order) && status === "new") return "POS sale";
  if (!isPickupOrder(order)) return status;
  const pickupLabels: Record<string, string> = {
    new: "new",
    preparing: "baking",
    shipped: "ready",
    delivered: "picked up",
  };
  return pickupLabels[status] ?? status;
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [fulfillments, setFulfillments] = useState<Record<string, Fulfillment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30d");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>("all");
  const [refundFilter, setRefundFilter] = useState<RefundFilter>("all");
  const [search, setSearch] = useState("");

  // Refunded order IDs (populated alongside orders fetch below). We key
  // on order_id so one lookup covers all attached refunds.
  const [refundedOrderIds, setRefundedOrderIds] = useState<Set<string>>(new Set());

  // Events dropdown for tagging orders. Small list — just pull all active
  // events. Used by the detail panel's event picker.
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [refunding, setRefunding] = useState(false);
  const [taggingEvent, setTaggingEvent] = useState(false);
  // Pickup reschedule state — only relevant for pickup orders. The picker
  // uses native datetime-local input so admins can pick any time. Server
  // enforces "not in the past" + slot conflict checks.
  const [reschedulingPickup, setReschedulingPickup] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [rescheduleNewTime, setRescheduleNewTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  // Current pickup time string for the selected order (read from raw
  // fulfillment when the modal opens). Used to render "currently scheduled"
  // info and seed the new-time input.
  const [currentPickupAt, setCurrentPickupAt] = useState<string | null>(null);

  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editTracking, setEditTracking] = useState("");
  const [editCarrier, setEditCarrier] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [priorStatus, setPriorStatus] = useState("new");
  const [autoSendEmail, setAutoSendEmail] = useState(true);
  const [emailAction, setEmailAction] = useState<"" | "preparing" | "shipped" | "delivered" | "confirmation" | "refunded">("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailResult, setEmailResult] = useState<string>("");

  // New-order toast
  const [newOrderToast, setNewOrderToast] = useState(false);
  const lastOrderIdsRef = useRef<Set<string>>(new Set());

  const fetchOrders = useCallback(async () => {
    setError("");
    try {
      const sinceIso = dateFilterToIso(dateFilter);

      let q = supabase
        .from("square_orders")
        .select(`
          id, created_at, state, total_money_cents, source_name, customer_id, raw, event_id,
          line_items:square_order_line_items(id, name, quantity, base_price_cents, variation_name),
          customer:square_customers(email, phone, given_name, family_name),
          event:events(id, title, date)
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (sinceIso) q = q.gte("created_at", sinceIso);

      const [ordersRes, fulfillRes, refundsRes, eventsRes] = await Promise.all([
        q,
        supabase.from("order_fulfillment").select("*"),
        // Any refund row (any status) attached to an order is enough to
        // mark it "refunded" in the UI — admin sees pending + completed.
        // We filter on completed only for the KPI exclusion elsewhere.
        supabase.from("square_refunds").select("order_id, status"),
        supabase.from("events").select("id, title, date").order("date", { ascending: false }),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      // Supabase types FK joins as arrays; flatten to single object for one-to-one relationships
      const fetched: Order[] = (ordersRes.data ?? []).map((row: any) => ({
        ...row,
        customer: Array.isArray(row.customer) ? row.customer[0] ?? null : row.customer,
        event: Array.isArray(row.event) ? row.event[0] ?? null : row.event,
      }));

      if (eventsRes.data) setEventOptions(eventsRes.data as EventOption[]);

      // New-order toast
      if (lastOrderIdsRef.current.size > 0) {
        const newOnes = fetched.filter((o) => !lastOrderIdsRef.current.has(o.id));
        if (newOnes.length > 0) {
          setNewOrderToast(true);
          try {
            new Audio("data:audio/wav;base64,UklGRngCAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVQCAAAAAP8A/wD/AP8A/wD/AP8A/wD/AP8A").play().catch(() => {});
          } catch { /* ignore */ }
          setTimeout(() => setNewOrderToast(false), 5000);
        }
      }
      lastOrderIdsRef.current = new Set(fetched.map((o) => o.id));
      setOrders(fetched);

      if (fulfillRes.data) {
        const map: Record<string, Fulfillment> = {};
        fulfillRes.data.forEach((f: Fulfillment) => { map[f.square_order_id] = f; });
        setFulfillments(map);
      }

      const refundSet = new Set<string>();
      for (const r of (refundsRes.data ?? []) as Array<{ order_id: string | null }>) {
        if (r.order_id) refundSet.add(r.order_id);
      }
      setRefundedOrderIds(refundSet);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
    setLoading(false);
  }, [dateFilter]);

  // Kick off a background sync on mount — catches any webhook-missed events.
  useEffect(() => {
    setLoading(true);
    fetchOrders();
    adminFetch("/api/admin/sync-recent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entities: ["orders", "payments", "customers"], hoursBack: 24 }),
    })
      .then(() => {
        setLastSyncAt(new Date().toISOString());
        // Refresh after sync completes
        fetchOrders();
      })
      .catch(() => { /* sync-recent is best-effort; main data is already loaded */ });
  }, [fetchOrders]);

  // Realtime: new orders and fulfillment edits
  useEffect(() => {
    const ch = supabase
      .channel("admin_orders_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "square_orders" }, () => fetchOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_fulfillment" }, () => fetchOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "square_refunds" }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders]);

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    const f = fulfillments[order.id];
    const current = f?.status || "new";
    setEditStatus(current);
    setPriorStatus(current);
    setEditTracking(f?.tracking_number || "");
    setEditCarrier(f?.carrier || "");
    setEditNotes(f?.notes || "");
    setAutoSendEmail(true);
    setEmailAction("");
    setEmailResult("");

    // Pull pickup time from the raw Square fulfillment so the reschedule
    // form can seed itself + show the current time. Same path-checking
    // pattern we use for isPickupOrder() — webhook events nest the order
    // differently (event.data.object.order vs the order object itself).
    const fulfillmentsRaw = order.raw?.fulfillments ?? order.raw?.order?.fulfillments ?? [];
    const pickupFulfillment = Array.isArray(fulfillmentsRaw)
      ? fulfillmentsRaw.find((f: { type?: string }) => f?.type === "PICKUP")
      : null;
    setCurrentPickupAt(pickupFulfillment?.pickupDetails?.pickupAt ?? null);
    setShowRescheduleForm(false);
    setRescheduleNewTime("");
    setRescheduleReason("");
  };

  const sendCustomerEmailFor = async (orderId: string, type: "confirmation" | "preparing" | "shipped" | "delivered" | "refunded") => {
    setEmailBusy(true);
    setEmailResult("");
    try {
      const res = await adminFetch("/api/admin/customer-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, type }),
      });
      const json = await res.json();
      if (!res.ok) {
        setEmailResult(`Error: ${json.error ?? "Send failed"}`);
      } else if (json.sent === false) {
        setEmailResult(json.reason ?? "Skipped");
      } else {
        setEmailResult(`Sent ${type} email ✓`);
      }
    } catch (err) {
      setEmailResult(err instanceof Error ? err.message : "Send failed");
    }
    setEmailBusy(false);
  };

  // Tag the selected order with an event (or untag with "").
  const saveOrderEvent = async (eventId: string | null) => {
    if (!selectedOrder) return;
    setTaggingEvent(true);
    try {
      const res = await adminFetch(`/api/admin/orders/${selectedOrder.id}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Save failed");
      }
      // Reflect the change locally so the row updates without a refetch.
      const picked = eventId ? eventOptions.find(e => e.id === eventId) ?? null : null;
      setSelectedOrder({ ...selectedOrder, event_id: eventId, event: picked });
      setOrders(prev => prev.map(o => o.id === selectedOrder.id
        ? { ...o, event_id: eventId, event: picked }
        : o));
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setTaggingEvent(false);
    }
  };

  // Kick off a refund via our /api/admin/orders/[id]/refund endpoint. The
  // endpoint calls Square's RefundPayment with the order's original
  // payment and upserts into square_refunds on success, so the Refunded
  // pill appears immediately.
  // Move a pickup order's time slot. Server enforces "not in the past" +
  // slot uniqueness; we surface the resulting message inline.
  const reschedulePickup = async () => {
    if (!selectedOrder) return;
    if (!rescheduleNewTime) {
      // eslint-disable-next-line no-alert
      alert("Pick a new pickup date + time first");
      return;
    }
    setReschedulingPickup(true);
    try {
      // datetime-local inputs come back without timezone — interpret as
      // local time of the bakery (America/New_York). The browser does the
      // local-zone interpretation already, then toISOString gives us UTC.
      const newPickupAtIso = new Date(rescheduleNewTime).toISOString();
      const res = await adminFetch(`/api/admin/orders/${selectedOrder.id}/reschedule-pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickup_at: newPickupAtIso, reason: rescheduleReason || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Reschedule failed");

      // Refresh local view
      setCurrentPickupAt(newPickupAtIso);
      setShowRescheduleForm(false);
      setRescheduleNewTime("");
      setRescheduleReason("");
      // eslint-disable-next-line no-alert
      alert(j.emailedTo
        ? `Pickup time updated. Customer notified at ${j.emailedTo}.`
        : "Pickup time updated. (No customer email on file — they won't get an automatic notification.)");
      fetchOrders();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : "Reschedule failed");
    } finally {
      setReschedulingPickup(false);
    }
  };

  const refundOrder = async () => {
    if (!selectedOrder) return;
    const confirmed = window.confirm(
      `Refund order #${selectedOrder.id.slice(-6).toUpperCase()} for ${
        selectedOrder.total_money_cents != null
          ? `$${(selectedOrder.total_money_cents / 100).toFixed(2)}`
          : "the full amount"
      }? This posts to Square immediately.`,
    );
    if (!confirmed) return;
    setRefunding(true);
    try {
      const res = await adminFetch(`/api/admin/orders/${selectedOrder.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Admin refund" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Refund failed");
      // Optimistically mark this order as refunded in the local set so the
      // pill shows up without waiting for the webhook round-trip.
      setRefundedOrderIds(prev => {
        const next = new Set(prev);
        next.add(selectedOrder.id);
        return next;
      });
      // eslint-disable-next-line no-alert
      alert("Refund sent to Square. Customer will receive their refund within 3–5 business days.");
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : "Refund failed");
    } finally {
      setRefunding(false);
    }
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
    if (existing) await supabase.from("order_fulfillment").update(data).eq("id", existing.id);
    else await supabase.from("order_fulfillment").insert(data);
    setSaving(false);

    // Auto-send a matching status email if the status changed and auto-send is on.
    const statusChanged = editStatus !== priorStatus;
    const isEmailableStatus = editStatus === "preparing" || editStatus === "shipped" || editStatus === "delivered";
    if (autoSendEmail && statusChanged && isEmailableStatus) {
      await sendCustomerEmailFor(
        selectedOrder.id,
        editStatus as "preparing" | "shipped" | "delivered",
      );
    }

    setSelectedOrder(null);
    fetchOrders();
  };

  const getOrderStatus = (order: Order): string => {
    const f = fulfillments[order.id];
    if (f) return f.status;
    if (order.state === "COMPLETED") return "new";
    return (order.state ?? "open").toLowerCase();
  };

  const formatPrice = (cents: number | null) => cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  // Client-side source + status + search filtering (date filter runs on the server)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => o.state === "COMPLETED" || o.state === "OPEN")
      .filter((o) => {
        if (sourceFilter === "all") return true;
        const online = isOnlineSource(o.source_name);
        return sourceFilter === "online" ? online : !online;
      })
      .filter((o) => statusFilter === "all" || getOrderStatus(o) === statusFilter)
      .filter((o) => {
        // Only applies to online orders — POS orders don't have fulfillment
        // metadata in raw.fulfillments, so "pickup/shipping" filter hides them.
        if (fulfillmentFilter === "all") return true;
        const online = isOnlineSource(o.source_name);
        if (!online) return false;
        const pickup = isPickupOrder(o);
        return fulfillmentFilter === "pickup" ? pickup : !pickup;
      })
      .filter((o) => {
        const refunded = refundedOrderIds.has(o.id);
        if (refundFilter === "hide-refunded") return !refunded;
        if (refundFilter === "only-refunded") return refunded;
        return true;
      })
      .filter((o) => {
        if (!q) return true;
        const bucket = [
          o.id,
          o.source_name ?? "",
          o.customer?.email ?? "",
          o.customer?.phone ?? "",
          o.customer?.given_name ?? "",
          o.customer?.family_name ?? "",
          fulfillments[o.id]?.tracking_number ?? "",
          ...(o.line_items ?? []).map((li) => li.name ?? ""),
        ].join(" ").toLowerCase();
        return bucket.includes(q);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, fulfillments, refundedOrderIds, sourceFilter, statusFilter, fulfillmentFilter, refundFilter, search]);

  // Stats on the CURRENT date window
  const liveOrders = orders.filter((o) => o.state === "COMPLETED" || o.state === "OPEN");
  const totalInWindow = liveOrders.length;
  const onlineCount = liveOrders.filter((o) => isOnlineSource(o.source_name)).length;
  const inPersonCount = totalInWindow - onlineCount;
  // Needs Fulfillment: only online orders that aren't refunded and are
  // still in the early workflow states. In-person POS orders are handled at
  // the register — they're done the moment the sale rings up, so counting
  // them drowns out the real work queue.
  const needFulfillment = liveOrders.filter((o) => {
    if (!isOnlineSource(o.source_name)) return false;
    if (refundedOrderIds.has(o.id)) return false;
    const s = getOrderStatus(o);
    return s === "new" || s === "preparing";
  }).length;

  const inputClass =
    "w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-2.5 text-[#5a3e36] text-sm placeholder:text-[#c4b5aa] focus:border-[#E8A0BF] focus:ring-1 focus:ring-[#E8A0BF] focus:outline-none";

  return (
    <div className="max-w-6xl">
      {newOrderToast && (
        <div className="fixed top-6 right-6 z-50 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <span className="text-lg">🎉</span>
          <span className="font-semibold">New order just came in!</span>
          <button onClick={() => setNewOrderToast(false)} className="text-white/70 hover:text-white ml-2">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-[#5a3e36]">Orders & Fulfillment</h2>
          <p className="text-[#b0a098] text-sm">
            Data from <code className="font-mono">square_orders</code> · Realtime · {lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleTimeString()}` : "Syncing…"}
          </p>
        </div>
        <button onClick={fetchOrders} className="border border-[#e8ddd4] text-[#7a6a62] hover:text-[#5a3e36] px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          Refresh
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-500 text-sm rounded-xl p-3 mb-4">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm border-l-4 border-l-[#1976D2]">
          <p className="text-[#b0a098] text-xs font-semibold mb-1">Needs Fulfillment</p>
          <p className="text-2xl font-bold text-[#1976D2]">{needFulfillment}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm border-l-4 border-l-green-500">
          <p className="text-[#b0a098] text-xs font-semibold mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-[#5a3e36]">{totalInWindow}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm border-l-4 border-l-[#E8A0BF]">
          <p className="text-[#b0a098] text-xs font-semibold mb-1">🌐 Online</p>
          <p className="text-2xl font-bold text-[#5a3e36]">{onlineCount}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm border-l-4 border-l-orange-400">
          <p className="text-[#b0a098] text-xs font-semibold mb-1">🏪 In-Person</p>
          <p className="text-2xl font-bold text-[#5a3e36]">{inPersonCount}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#f0e6de] p-3 mb-4 flex flex-wrap gap-2 items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email, phone, name, product, tracking #…"
          className="flex-1 min-w-[200px] bg-[#FFF9F4] border border-[#e8ddd4] rounded-lg px-3 py-2 text-sm text-[#5a3e36] placeholder:text-[#c4b5aa] focus:border-[#E8A0BF] focus:outline-none"
        />
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
          className="bg-white border border-[#e8ddd4] rounded-lg px-3 py-2 text-sm">
          <option value="all">All sources</option>
          <option value="online">🌐 Online</option>
          <option value="in-person">🏪 In-Person</option>
        </select>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="bg-white border border-[#e8ddd4] rounded-lg px-3 py-2 text-sm">
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-white border border-[#e8ddd4] rounded-lg px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="preparing">Preparing / Baking</option>
          <option value="shipped">Shipped / Ready</option>
          <option value="delivered">Delivered / Picked up</option>
        </select>
        <select value={fulfillmentFilter} onChange={(e) => setFulfillmentFilter(e.target.value as FulfillmentFilter)}
          className="bg-white border border-[#e8ddd4] rounded-lg px-3 py-2 text-sm">
          <option value="all">All types</option>
          <option value="pickup">🏪 Pickup only</option>
          <option value="shipping">📦 Shipping only</option>
        </select>
        <select value={refundFilter} onChange={(e) => setRefundFilter(e.target.value as RefundFilter)}
          className="bg-white border border-[#e8ddd4] rounded-lg px-3 py-2 text-sm">
          <option value="all">Refunds: all</option>
          <option value="hide-refunded">Hide refunded</option>
          <option value="only-refunded">Only refunded</option>
        </select>
      </div>

      {/* Quick filters — one-click presets for the common work queues */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => { setStatusFilter("new"); setSourceFilter("online"); setRefundFilter("hide-refunded"); setFulfillmentFilter("all"); }}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#E3F2FD] text-[#1976D2] hover:brightness-95 transition-all"
        >
          🆕 Needs fulfillment
        </button>
        <button
          onClick={() => { setStatusFilter("all"); setSourceFilter("all"); setRefundFilter("all"); setFulfillmentFilter("pickup"); }}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#FFF0F5] text-burgundy hover:brightness-95 transition-all"
        >
          🏪 Pickup orders
        </button>
        <button
          onClick={() => { setStatusFilter("shipped"); setSourceFilter("online"); setRefundFilter("hide-refunded"); setFulfillmentFilter("all"); }}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 hover:brightness-95 transition-all"
        >
          📦 Ready / Shipped
        </button>
        <button
          onClick={() => { setStatusFilter("all"); setSourceFilter("all"); setRefundFilter("all"); setFulfillmentFilter("all"); setSearch(""); }}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#FFF5EE] text-[#7a6a62] hover:brightness-95 transition-all"
        >
          Clear all filters
        </button>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#E8A0BF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#f0e6de]">
          <p className="text-[#7a6a62] mb-1">No orders match these filters.</p>
          <p className="text-[#b0a098] text-xs">Widen the date range or clear filters to see more.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => {
            const status = getOrderStatus(order);
            const f = fulfillments[order.id];
            const online = isOnlineSource(order.source_name);
            const customer = order.customer;
            const customerLabel = customer
              ? `${customer.given_name ?? ""} ${customer.family_name ?? ""}`.trim() || customer.email || customer.phone || ""
              : "";
            return (
              <div key={order.id} onClick={() => openOrderDetail(order)}
                className="bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm hover:shadow-md hover:border-[#E8A0BF]/30 transition-all cursor-pointer">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-[#5a3e36] font-mono text-sm font-bold">#{order.id.slice(-6).toUpperCase()}</span>
                    <span className="text-base">{online ? "🌐" : "🏪"}</span>
                    {customerLabel && (
                      <span className="text-[#7a6a62] text-xs hidden md:block truncate max-w-[180px]">{customerLabel}</span>
                    )}
                    <span className="text-[#b0a098] text-xs hidden md:block">{formatDate(order.created_at)}</span>
                    <span className="text-[#b0a098] text-xs hidden lg:block">
                      {(order.line_items?.length ?? 0)} item{(order.line_items?.length ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {order.event && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 hidden md:inline">
                        🎪 {order.event.title}
                      </span>
                    )}
                    {refundedOrderIds.has(order.id) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-50 text-red-500">💸 Refunded</span>
                    )}
                    {f?.tracking_number && <span className="text-purple-500 text-[10px] font-bold">📦 Tracked</span>}
                    <span className="text-[#5a3e36] font-bold text-sm">{formatPrice(order.total_money_cents)}</span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                      isInPersonOrder(order) && status === "new"
                        ? posBadgeColor
                        : statusColors[status] || "bg-[#FFF5EE] text-[#b0a098]"
                    }`}>
                      {statusLabel(order, status)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl border border-[#f0e6de] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#f0e6de]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[#5a3e36] text-lg font-bold">Order #{selectedOrder.id.slice(-6).toUpperCase()}</h3>
                  <p className="text-[#b0a098] text-xs">{formatDate(selectedOrder.created_at)}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 rounded-full bg-[#FFF5EE] flex items-center justify-center text-[#b0a098]">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-base">{isOnlineSource(selectedOrder.source_name) ? "🌐" : "🏪"}</span>
                <span className="text-[#5a3e36] font-medium">{selectedOrder.source_name || "In-Person POS"}</span>
              </div>

              {selectedOrder.customer && (
                <div className="bg-[#FFF5EE] rounded-lg p-3 text-sm">
                  <p className="text-[#5a3e36] font-medium">
                    {[selectedOrder.customer.given_name, selectedOrder.customer.family_name].filter(Boolean).join(" ") || "—"}
                  </p>
                  {selectedOrder.customer.email && <p className="text-[#7a6a62] text-xs mt-0.5">{selectedOrder.customer.email}</p>}
                  {selectedOrder.customer.phone && <p className="text-[#7a6a62] text-xs">{selectedOrder.customer.phone}</p>}
                </div>
              )}

              <div>
                <p className="text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-1.5">
                  {(selectedOrder.line_items ?? []).map((li) => (
                    <div key={li.id} className="flex items-center justify-between bg-[#FFF5EE] rounded-lg p-3">
                      <div>
                        <span className="text-[#5a3e36] text-sm font-medium">{li.name ?? "—"}</span>
                        <span className="text-[#b0a098] text-sm ml-2">×{li.quantity ?? 1}</span>
                      </div>
                      <span className="text-[#5a3e36] font-semibold text-sm">{formatPrice(li.base_price_cents)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-3 pt-3 border-t border-[#f0e6de]">
                  <span className="text-[#5a3e36] font-bold">Total</span>
                  <span className="text-[#5a3e36] text-xl font-bold">{formatPrice(selectedOrder.total_money_cents)}</span>
                </div>
              </div>

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
                          {statusLabel(selectedOrder, s)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(editStatus === "shipped" || editStatus === "delivered") && !isPickupOrder(selectedOrder) && (
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

              {/* Pickup reschedule — only meaningful for pickup orders that
                  haven't already been picked up. The button reveals a small
                  inline form rather than a full modal because the rest of
                  the detail panel is already a modal. */}
              {isPickupOrder(selectedOrder) && currentPickupAt && editStatus !== "delivered" && (
                <div className="border-t border-[#f0e6de] pt-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="text-[#7a6a62] text-xs font-semibold uppercase tracking-wider">
                      ⏰ Pickup time
                    </label>
                    {!showRescheduleForm && (
                      <button
                        onClick={() => {
                          // Seed the input with the current pickup time formatted for
                          // datetime-local (YYYY-MM-DDTHH:mm). Browser does the local-zone
                          // conversion when we omit the seconds + Z suffix.
                          const d = new Date(currentPickupAt);
                          const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
                          setRescheduleNewTime(local.toISOString().slice(0, 16));
                          setShowRescheduleForm(true);
                        }}
                        className="text-xs text-[#843430] font-bold hover:underline"
                      >
                        Reschedule →
                      </button>
                    )}
                  </div>
                  <p className="text-[#5a3e36] text-sm mb-2">
                    Currently scheduled: <strong>{new Date(currentPickupAt).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                      weekday: "short", month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit", hour12: true,
                    })}</strong>
                  </p>
                  {showRescheduleForm && (
                    <div className="bg-[#FFF5EE] border border-[#f0e6de] rounded-xl p-3 space-y-2">
                      <div>
                        <label className="block text-[#7a6a62] text-[11px] font-semibold uppercase tracking-wider mb-1">New pickup time</label>
                        <input
                          type="datetime-local"
                          value={rescheduleNewTime}
                          onChange={(e) => setRescheduleNewTime(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[#7a6a62] text-[11px] font-semibold uppercase tracking-wider mb-1">
                          Reason for change <span className="text-[#b0a098] normal-case font-normal">(shown to customer)</span>
                        </label>
                        <input
                          type="text"
                          value={rescheduleReason}
                          onChange={(e) => setRescheduleReason(e.target.value)}
                          placeholder="e.g. Oven repair this morning, sorry for the inconvenience"
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowRescheduleForm(false); setRescheduleNewTime(""); setRescheduleReason(""); }}
                          disabled={reschedulingPickup}
                          className="flex-1 border border-[#e8ddd4] text-[#7a6a62] py-2 rounded-xl text-xs font-semibold hover:bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={reschedulePickup}
                          disabled={reschedulingPickup || !rescheduleNewTime}
                          className="flex-1 bg-[#843430] text-white py-2 rounded-xl text-xs font-bold hover:bg-[#6e2a27] disabled:opacity-50"
                        >
                          {reschedulingPickup ? "Saving…" : "Save + email customer"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Event tagging — useful for in-person POS sales at Haley's
                  tent events. Also available on online orders in case you
                  want to attribute a catering order to an event you worked. */}
              <div className="border-t border-[#f0e6de] pt-4">
                <label className="block text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-1.5">
                  🎪 Event
                </label>
                <select
                  value={selectedOrder.event_id ?? ""}
                  onChange={(e) => saveOrderEvent(e.target.value || null)}
                  disabled={taggingEvent || eventOptions.length === 0}
                  className={inputClass}
                >
                  <option value="">{eventOptions.length === 0 ? "No events created yet — add via Events page" : "— No event —"}</option>
                  {eventOptions.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} · {new Date(ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </option>
                  ))}
                </select>
                {selectedOrder.event && (
                  <p className="text-[#b0a098] text-xs mt-1">Currently tagged: {selectedOrder.event.title}</p>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 text-xs text-[#5a3e36] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSendEmail}
                    onChange={(e) => setAutoSendEmail(e.target.checked)}
                    className="w-4 h-4 accent-[#E8A0BF]"
                  />
                  <span>Auto-send customer email on status change</span>
                </label>

                <button onClick={saveFulfillment} disabled={saving}
                  className="w-full bg-[#E8A0BF] text-white py-3 rounded-xl font-bold hover:bg-[#d889ad] disabled:opacity-50">
                  {saving ? "Saving..." : "Save Fulfillment"}
                </button>

                <div className="flex gap-2">
                  <select
                    value={emailAction}
                    onChange={(e) => setEmailAction(e.target.value as typeof emailAction)}
                    className="flex-1 bg-white border border-[#e8ddd4] rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">Manually send email…</option>
                    <option value="confirmation">Order confirmation</option>
                    <option value="preparing">{isPickupOrder(selectedOrder) ? "Baking" : "Preparing"}</option>
                    <option value="shipped">{isPickupOrder(selectedOrder) ? "Ready for pickup" : "Shipped"}</option>
                    <option value="delivered">{isPickupOrder(selectedOrder) ? "Picked up" : "Delivered"}</option>
                    <option value="refunded">Refund processed</option>
                  </select>
                  <button
                    disabled={!emailAction || emailBusy}
                    onClick={() => emailAction && sendCustomerEmailFor(selectedOrder.id, emailAction)}
                    className="shrink-0 px-4 py-2 border border-[#e8ddd4] text-[#7a6a62] rounded-xl text-sm font-semibold hover:bg-[#FFF5EE] transition-colors disabled:opacity-40"
                  >
                    {emailBusy ? "…" : "Send"}
                  </button>
                </div>
                {emailResult && (
                  <p className={`text-xs ${emailResult.startsWith("Error") ? "text-red-500" : "text-[#7a6a62]"}`}>
                    {emailResult}
                  </p>
                )}

                {/* Refund button — hidden for already-refunded orders since
                    a second refund on the same payment would error out on
                    Square. Disabled state while the request is in flight so
                    we don't double-submit. */}
                {!refundedOrderIds.has(selectedOrder.id) && (
                  <button
                    onClick={refundOrder}
                    disabled={refunding}
                    className="w-full border border-red-300 text-red-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {refunding ? "Refunding…" : "💸 Refund this order"}
                  </button>
                )}
                {refundedOrderIds.has(selectedOrder.id) && (
                  <p className="text-red-500 text-xs text-center py-2">
                    💸 Already refunded — issue a second refund from Square Dashboard if needed.
                  </p>
                )}

                <a href={`https://squareup.com/dashboard/orders/overview/${selectedOrder.id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="block w-full text-center border border-[#e8ddd4] text-[#7a6a62] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#FFF5EE] transition-colors">
                  Open in Square Dashboard →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
