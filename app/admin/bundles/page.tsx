"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface BundleTier {
  id: string;
  name: string;
  item_count: number;
  price_cents: number;
  shipping_eligible: boolean;
  pickup_only: boolean;
  is_active: boolean;
  sort_order: number;
  shipping_cost_cents: number;
}

const emptyTier = { name: "", item_count: 3, price_cents: 2000, shipping_eligible: false, pickup_only: true, is_active: true, sort_order: 0, shipping_cost_cents: 0 };

export default function AdminBundles() {
  const [tiers, setTiers] = useState<BundleTier[]>([]);
  const [editing, setEditing] = useState<BundleTier | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyTier);
  const [saving, setSaving] = useState(false);

  const fetch_ = useCallback(async () => {
    const { data } = await supabase.from("bundle_tiers").select("*").order("sort_order");
    if (data) setTiers(data);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
    await supabase.from("bundle_tiers").insert({ ...form, sort_order: tiers.length });
    setSaving(false); setCreating(false); setForm(emptyTier); fetch_();
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    const { id, ...rest } = editing;
    await supabase.from("bundle_tiers").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id);
    setSaving(false); setEditing(null); fetch_();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this bundle tier?")) return;
    await supabase.from("bundle_tiers").delete().eq("id", id);
    fetch_();
  };

  const toggleActive = async (tier: BundleTier) => {
    await supabase.from("bundle_tiers").update({ is_active: !tier.is_active }).eq("id", tier.id);
    fetch_();
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const inputClass = "w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-2.5 text-[#5a3e36] text-sm placeholder:text-[#c4b5aa] focus:border-[#E8A0BF] focus:ring-1 focus:ring-[#E8A0BF] focus:outline-none";
  const labelClass = "block text-[#7a6a62] text-xs font-semibold mb-1.5 uppercase tracking-wider";

  const renderForm = (data: typeof form, setData: (d: typeof form) => void, onSave: () => void, onCancel: () => void, title: string) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl p-7 border border-[#f0e6de] w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[#5a3e36] text-lg font-bold mb-5">{title}</h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Bundle Name</label>
            <input type="text" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} className={inputClass} placeholder="e.g., 3-Pack" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Items in Bundle</label>
              <input type="number" value={data.item_count} onChange={(e) => setData({ ...data, item_count: parseInt(e.target.value) || 1 })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4b5aa] text-sm">$</span>
                <input type="number" step="0.01" value={(data.price_cents / 100).toFixed(2)} onChange={(e) => setData({ ...data, price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })} className={`${inputClass} pl-7`} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between bg-[#FFF9F4] rounded-xl p-3 border border-[#e8ddd4]">
            <div>
              <p className="text-[#5a3e36] text-sm font-semibold">Shipping Eligible</p>
              <p className="text-[#b0a098] text-xs">Can this bundle be shipped?</p>
            </div>
            <button onClick={() => setData({ ...data, shipping_eligible: !data.shipping_eligible, pickup_only: data.shipping_eligible ? true : false })}
              className={`w-11 h-6 rounded-full transition-colors relative ${data.shipping_eligible ? "bg-green-400" : "bg-[#e0d5cc]"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${data.shipping_eligible ? "left-6" : "left-1"}`} />
            </button>
          </div>
          {data.shipping_eligible && (
            <div>
              <label className={labelClass}>Cold Pack Shipping Cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4b5aa] text-sm">$</span>
                <input type="number" step="0.01"
                  value={(data.shipping_cost_cents ? (data.shipping_cost_cents / 100).toFixed(2) : "")}
                  onChange={(e) => setData({ ...data, shipping_cost_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                  className={`${inputClass} pl-7`} placeholder="14.99" />
              </div>
              <p className="text-[#b0a098] text-xs mt-1">🧊 Includes insulated box + cold packs</p>
            </div>
          )}
          <div className="flex items-center justify-between bg-[#FFF9F4] rounded-xl p-3 border border-[#e8ddd4]">
            <div>
              <p className="text-[#5a3e36] text-sm font-semibold">Active</p>
              <p className="text-[#b0a098] text-xs">Show on the website</p>
            </div>
            <button onClick={() => setData({ ...data, is_active: !data.is_active })}
              className={`w-11 h-6 rounded-full transition-colors relative ${data.is_active ? "bg-[#E8A0BF]" : "bg-[#e0d5cc]"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${data.is_active ? "left-6" : "left-1"}`} />
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 border border-[#e8ddd4] text-[#7a6a62] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#FFF9F4]">Cancel</button>
          <button onClick={onSave} disabled={saving || !data.name} className="flex-1 bg-[#E8A0BF] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#d889ad] disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#5a3e36]">Bundle Deals</h2>
          <p className="text-[#b0a098] text-sm">Set up combo tiers for the box builder</p>
        </div>
        <button onClick={() => setCreating(true)} className="bg-[#E8A0BF] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#d889ad] transition-colors">
          + New Bundle
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 border border-[#f0e6de] mb-5 flex items-center gap-3">
        <span className="text-lg">📦</span>
        <p className="text-[#7a6a62] text-sm">
          Customers pick a bundle size, then choose which products fill their box. Only shipping-eligible bundles can be shipped — others are pickup only.
        </p>
      </div>

      <div className="space-y-2">
        {tiers.map((tier) => (
          <div key={tier.id} className={`bg-white rounded-xl p-4 border border-[#f0e6de] shadow-sm flex items-center justify-between gap-4 ${!tier.is_active ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-xl bg-[#FCE4EC] flex items-center justify-center text-xl font-bold text-[#c2185b]">
                {tier.item_count}
              </div>
              <div>
                <h3 className="text-[#5a3e36] font-semibold text-sm">{tier.name}</h3>
                <div className="flex items-center gap-2 text-xs text-[#b0a098]">
                  <span className="font-bold text-[#5a3e36]">{formatPrice(tier.price_cents)}</span>
                  <span>•</span>
                  <span>{tier.item_count} items</span>
                  <span>•</span>
                  {tier.shipping_eligible ? (
                    <span className="text-green-600 font-semibold">
                      Ships ✓ {tier.shipping_cost_cents ? `(+${formatPrice(tier.shipping_cost_cents as number)})` : ""}
                    </span>
                  ) : (
                    <span className="text-orange-500 font-semibold">Pickup only</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => toggleActive(tier)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${tier.is_active ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-500"}`}>
                {tier.is_active ? "Live" : "Off"}
              </button>
              <button onClick={() => setEditing(tier)}
                className="px-2.5 py-1.5 rounded-lg bg-[#FFF9F4] text-[#7a6a62] text-[10px] font-bold border border-[#e8ddd4]">
                Edit
              </button>
              <button onClick={() => handleDelete(tier.id)}
                className="px-2 py-1.5 rounded-lg bg-[#FFF9F4] text-[#c4b5aa] text-[10px] font-bold border border-[#e8ddd4] hover:text-red-500">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {creating && renderForm(form, setForm, handleCreate, () => { setCreating(false); setForm(emptyTier); }, "New Bundle Tier")}
      {editing && renderForm(editing as unknown as typeof form, (d) => setEditing({ ...editing, ...d } as BundleTier), handleUpdate, () => setEditing(null), `Edit: ${editing.name}`)}
    </div>
  );
}
