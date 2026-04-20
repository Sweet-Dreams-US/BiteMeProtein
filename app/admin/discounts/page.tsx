"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";

interface DiscountRow {
  id: string;
  code: string;
  name: string;
  discount_type: "per_item_fixed_price" | "percent_off" | "fixed_off";
  amount_cents: number | null;
  percent: number | null;
  fulfillment_restriction: "all" | "pickup" | "shipping";
  product_scope: "all" | "allowlist";
  allowed_square_product_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  max_total_uses: number | null;
  max_per_customer: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  usage_count: number;
  total_saved_cents: number;
}

const emptyForm = (): Partial<DiscountRow> => ({
  code: "",
  name: "",
  discount_type: "per_item_fixed_price",
  amount_cents: 500,
  percent: null,
  fulfillment_restriction: "all",
  product_scope: "all",
  allowed_square_product_ids: null,
  starts_at: null,
  ends_at: null,
  max_total_uses: null,
  max_per_customer: null,
  is_active: true,
  notes: "",
});

const formatPrice = (c: number) => `$${(c / 100).toFixed(2)}`;

const typeLabel: Record<string, string> = {
  per_item_fixed_price: "Each item = $X",
  percent_off: "% off (not yet applied at checkout)",
  fixed_off: "$ off total (not yet applied at checkout)",
};

export default function AdminDiscountsPage() {
  const [rows, setRows] = useState<DiscountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Editor state (null = closed; id = editing; "new" = creating)
  const [editing, setEditing] = useState<null | "new" | string>(null);
  const [form, setForm] = useState<Partial<DiscountRow>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await adminFetch("/api/admin/discounts");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setRows(json.rows ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm(emptyForm());
    setSaveError("");
    setEditing("new");
  };

  const openEdit = (row: DiscountRow) => {
    setForm({ ...row });
    setSaveError("");
    setEditing(row.id);
  };

  const close = () => {
    setEditing(null);
    setForm(emptyForm());
    setSaveError("");
  };

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const body = { ...form };
      // Coerce empties to nulls
      for (const k of Object.keys(body) as (keyof typeof body)[]) {
        if (body[k] === "") (body as Record<string, unknown>)[k as string] = null;
      }
      const isNew = editing === "new";
      const res = await adminFetch("/api/admin/discounts", {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isNew ? body : { ...body, id: editing }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      await load();
      close();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
    setSaving(false);
  };

  const remove = async (row: DiscountRow) => {
    if (!confirm(`Delete code "${row.code}"? All ${row.usage_count} redemption records will be removed too.`)) return;
    const res = await adminFetch(`/api/admin/discounts?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? "Delete failed");
      return;
    }
    await load();
  };

  const inputClass =
    "w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-3 py-2 text-[#5a3e36] text-sm placeholder:text-[#c4b5aa] focus:border-[#E8A0BF] focus:ring-1 focus:ring-[#E8A0BF] focus:outline-none";

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#5a3e36]">Discount codes</h1>
          <p className="text-[#b0a098] text-sm mt-1">Promo codes customers enter at checkout. Usage counters auto-update on redemption.</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 bg-[#843430] hover:bg-[#6e2a27] text-white rounded-xl font-semibold text-sm transition-colors">
          + New code
        </button>
      </div>

      {loadError && <div className="bg-red-50 border border-red-200 text-red-500 text-sm rounded-xl p-3 mb-4">{loadError}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#E8A0BF] border-t-transparent rounded-full animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#f0e6de] p-10 text-center">
          <p className="text-[#5a3e36] font-medium mb-2">No codes yet.</p>
          <p className="text-[#b0a098] text-sm">Click &quot;New code&quot; to create your first promo code.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="bg-white rounded-xl border border-[#f0e6de] p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-[#5a3e36] font-bold">{row.code}</code>
                  {row.is_active ? (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-green-50 text-green-600 rounded">Active</span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded">Paused</span>
                  )}
                  {row.fulfillment_restriction === "pickup" && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-orange-50 text-orange-600 rounded">Pickup only</span>
                  )}
                  {row.fulfillment_restriction === "shipping" && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-purple-50 text-purple-600 rounded">Shipping only</span>
                  )}
                </div>
                <p className="text-[#7a6a62] text-sm mt-1">{row.name}</p>
                <p className="text-[#b0a098] text-xs mt-1">
                  {typeLabel[row.discount_type]}
                  {row.discount_type === "per_item_fixed_price" && row.amount_cents != null && ` — ${formatPrice(row.amount_cents)}`}
                  {row.discount_type === "percent_off" && row.percent != null && ` — ${row.percent}%`}
                  {row.discount_type === "fixed_off" && row.amount_cents != null && ` — ${formatPrice(row.amount_cents)}`}
                </p>
                <p className="text-[#b0a098] text-xs mt-1">
                  {row.usage_count} redemptions · {formatPrice(row.total_saved_cents)} saved by customers
                  {row.max_total_uses != null && ` (max ${row.max_total_uses})`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(row)}
                  className="px-3 py-1.5 text-xs font-semibold border border-[#e8ddd4] text-[#7a6a62] rounded-lg hover:bg-[#FFF5EE]">
                  Edit
                </button>
                <button onClick={() => remove(row)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#b0a098] hover:text-red-500">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Editor drawer */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={close}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl border border-[#f0e6de] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#f0e6de] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#5a3e36]">{editing === "new" ? "New discount code" : "Edit code"}</h2>
              <button onClick={close} className="w-8 h-8 rounded-full bg-[#FFF5EE] flex items-center justify-center text-[#b0a098]">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-[#7a6a62] mb-1.5">Code *</span>
                <input type="text" value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="BiteMeTraining" className={inputClass} />
                <span className="text-[10px] text-[#b0a098] mt-1 block">Case-insensitive at the customer&apos;s end.</span>
              </label>

              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-[#7a6a62] mb-1.5">Label *</span>
                <input type="text" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Trainer referral — $5 per piece" className={inputClass} />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#7a6a62] mb-1.5">Type *</span>
                  <select value={form.discount_type ?? "per_item_fixed_price"}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value as DiscountRow["discount_type"] })}
                    className={inputClass}>
                    <option value="per_item_fixed_price">Each item = $X (recommended)</option>
                    <option value="percent_off">% off (future)</option>
                    <option value="fixed_off">$ off total (future)</option>
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#7a6a62] mb-1.5">
                    {form.discount_type === "percent_off" ? "Percent (0–100)" : "Amount (cents)"}
                  </span>
                  {form.discount_type === "percent_off" ? (
                    <input type="number" min={0} max={100} value={form.percent ?? ""}
                      onChange={(e) => setForm({ ...form, percent: e.target.value === "" ? null : Number(e.target.value) })}
                      className={inputClass} />
                  ) : (
                    <input type="number" min={0} value={form.amount_cents ?? ""}
                      onChange={(e) => setForm({ ...form, amount_cents: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="500 = $5.00" className={inputClass} />
                  )}
                </label>
              </div>

              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-[#7a6a62] mb-1.5">Fulfillment restriction</span>
                <select value={form.fulfillment_restriction ?? "all"}
                  onChange={(e) => setForm({ ...form, fulfillment_restriction: e.target.value as DiscountRow["fulfillment_restriction"] })}
                  className={inputClass}>
                  <option value="all">All orders</option>
                  <option value="pickup">Pickup only</option>
                  <option value="shipping">Shipping only</option>
                </select>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#7a6a62] mb-1.5">Starts at</span>
                  <input type="datetime-local" value={form.starts_at ? form.starts_at.slice(0, 16) : ""}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className={inputClass} />
                </label>

                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#7a6a62] mb-1.5">Ends at</span>
                  <input type="datetime-local" value={form.ends_at ? form.ends_at.slice(0, 16) : ""}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className={inputClass} />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#7a6a62] mb-1.5">Max total uses</span>
                  <input type="number" min={0} value={form.max_total_uses ?? ""}
                    onChange={(e) => setForm({ ...form, max_total_uses: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="unlimited" className={inputClass} />
                </label>

                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#7a6a62] mb-1.5">Max per customer</span>
                  <input type="number" min={0} value={form.max_per_customer ?? ""}
                    onChange={(e) => setForm({ ...form, max_per_customer: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="unlimited" className={inputClass} />
                </label>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active ?? true}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 accent-[#E8A0BF]" />
                <span className="text-sm text-[#5a3e36]">Active (customers can use this code)</span>
              </label>

              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-[#7a6a62] mb-1.5">Admin notes</span>
                <textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g., Trainer Haley's referral code — for Instagram promo 2026-04"
                  className={inputClass} />
              </label>

              {saveError && <p className="text-red-500 text-sm">{saveError}</p>}

              <div className="flex gap-2 pt-2">
                <button onClick={save} disabled={saving || !form.code || !form.name}
                  className="flex-1 bg-[#843430] hover:bg-[#6e2a27] text-white py-3 rounded-xl font-bold disabled:opacity-50">
                  {saving ? "Saving…" : editing === "new" ? "Create code" : "Save changes"}
                </button>
                <button onClick={close}
                  className="px-5 border border-[#e8ddd4] text-[#7a6a62] rounded-xl hover:bg-[#FFF5EE]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
