"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import ProductImageManager from "@/components/admin/ProductImageManager";
import { slugForProductName } from "@/lib/product-slugs";
import { isPosBundle } from "@/lib/pos-bundles";
import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-fetch";

interface Variation {
  id?: string;
  name: string;
  priceMoney: { amount: number; currency: string } | null;
  sku: string | null;
  trackInventory: boolean;
  inventoryCount: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  variations: Variation[];
}

interface Enrichment {
  id: string;
  square_catalog_id: string;
  extended_description: string | null;
  ingredients: string | null;
  nutrition_info: string | null;
  badges: string[];
  website_category: string | null;
  is_visible: boolean;
  sort_order: number;
  cost_per_item_cents: number;
}

interface NewProduct {
  name: string;
  description: string;
  variations: { name: string; price: number; sku: string }[];
  trackInventory: boolean;
}

const BADGE_OPTIONS = ["New!", "Best Seller", "Seasonal", "Limited Edition", "Staff Pick", "Fan Favorite"];
const CATEGORY_OPTIONS = ["Brownies", "Muffins", "Banana Bread", "Truffles", "Seasonal", "Specials"];

const emptyProduct: NewProduct = {
  name: "", description: "",
  variations: [{ name: "Regular", price: 0, sku: "" }],
  trackInventory: false,
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [enrichments, setEnrichments] = useState<Record<string, Enrichment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newProduct, setNewProduct] = useState<NewProduct>({ ...emptyProduct });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingEnrichment, setEditingEnrichment] = useState<Enrichment | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await adminFetch("/api/square/catalog");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProducts(data.items || []);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load"); }
    setLoading(false);
  }, []);

  const fetchEnrichments = useCallback(async () => {
    const { data } = await supabase.from("product_enrichments").select("*");
    if (data) {
      const map: Record<string, Enrichment> = {};
      data.forEach((e: Enrichment) => { map[e.square_catalog_id] = e; });
      setEnrichments(map);
    }
  }, []);

  useEffect(() => { fetchProducts(); fetchEnrichments(); }, [fetchProducts, fetchEnrichments]);

  const handleCreate = async () => {
    if (!newProduct.name) return;
    setSaving(true);
    try {
      const res = await adminFetch("/api/square/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newProduct) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCreating(false); setNewProduct({ ...emptyProduct }); fetchProducts();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : "Failed"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product? This removes it from Square too.")) return;
    const res = await fetch(`/api/square/catalog?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) alert(data.error);
    else fetchProducts();
  };

  /**
   * Open the unified edit modal for one product. Pulls the catalog data
   * straight from the row and seeds enrichment from Supabase (or a blank
   * stub if this product has never had website metadata).
   *
   * Replaces the prior split flow where "Edit" only opened catalog fields
   * and "Details" opened website fields — Cole found that confusing because
   * Details actually held more editable data than Edit did. Now there's
   * one button, one modal, one mental model.
   */
  const openEdit = (product: Product) => {
    setEditingProduct({ ...product });
    const existing = enrichments[product.id];
    setEditingEnrichment(existing ? { ...existing } : {
      id: "", square_catalog_id: product.id, extended_description: "", ingredients: "", nutrition_info: "",
      badges: [], website_category: null, is_visible: true, sort_order: 0, cost_per_item_cents: 0,
    });
  };

  const closeEdit = () => {
    setEditingProduct(null);
    setEditingEnrichment(null);
  };

  /**
   * Save catalog (Square) + website metadata (Supabase) in parallel.
   * Either side failing surfaces the error inline and leaves the modal
   * open so the admin can retry without losing typed-in fields.
   */
  const handleSaveAll = async () => {
    if (!editingProduct) return;
    setSaving(true);
    try {
      const catalogPromise = adminFetch("/api/square/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingProduct.id,
          name: editingProduct.name,
          description: editingProduct.description,
          variations: editingProduct.variations.map((v) => ({
            id: v.id, name: v.name,
            price: v.priceMoney ? v.priceMoney.amount / 100 : 0,
            sku: v.sku,
          })),
          trackInventory: editingProduct.variations[0]?.trackInventory ?? false,
        }),
      }).then(async (res) => {
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      });

      const enrichmentPromise = (async () => {
        if (!editingEnrichment) return;
        const { id, ...rest } = editingEnrichment;
        if (id) {
          await supabase
            .from("product_enrichments")
            .update({ ...rest, updated_at: new Date().toISOString() })
            .eq("id", id);
        } else {
          await supabase.from("product_enrichments").insert(rest);
        }
      })();

      await Promise.all([catalogPromise, enrichmentPromise]);
      closeEdit();
      fetchProducts();
      fetchEnrichments();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Save failed");
    }
    setSaving(false);
  };

  const toggleVisibility = async (product: Product) => {
    const existing = enrichments[product.id];
    if (existing) {
      await supabase.from("product_enrichments").update({ is_visible: !existing.is_visible }).eq("id", existing.id);
    } else {
      await supabase.from("product_enrichments").insert({ square_catalog_id: product.id, is_visible: false, sort_order: 0 });
    }
    fetchEnrichments();
  };

  const formatPrice = (amount: number) => `$${(amount / 100).toFixed(2)}`;

  const inputClass = "w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-2.5 text-[#5a3e36] text-sm placeholder:text-[#c4b5aa] focus:border-[#E8A0BF] focus:ring-1 focus:ring-[#E8A0BF] focus:outline-none";
  const labelClass = "block text-[#7a6a62] text-xs font-semibold mb-1.5 uppercase tracking-wider";

  // Split the catalog into combos (POS pricing shortcuts that don't show
  // on the storefront) vs individual products (the actual baked goods
  // customers buy). The set lives in lib/pos-bundles.ts so the bestsellers
  // homepage filter and this admin grouping never drift apart.
  const { individualProducts, comboProducts } = useMemo(() => {
    const individual: Product[] = [];
    const combos: Product[] = [];
    for (const p of products) {
      if (isPosBundle(p.name)) combos.push(p);
      else individual.push(p);
    }
    return { individualProducts: individual, comboProducts: combos };
  }, [products]);

  // Single row renderer used by both the Individual and Combos sections —
  // keeping the markup in one place avoids drift when we tweak the badges
  // or button styles later.
  const renderProductRow = (product: Product) => {
    const enrichment = enrichments[product.id];
    const mainVar = product.variations[0];
    const isHidden = enrichment?.is_visible === false;
    return (
      <div key={product.id} className={`bg-white rounded-xl p-4 border border-[#f0e6de] transition-all hover:shadow-sm ${isHidden ? "opacity-50" : ""}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="text-[#5a3e36] font-semibold text-sm">{product.name}</h3>
              {enrichment?.badges.map((b) => (
                <span key={b} className="bg-[#FCE4EC] text-[#c2185b] text-[10px] font-bold px-2 py-0.5 rounded-full">{b}</span>
              ))}
              {isHidden && <span className="text-orange-500 text-[10px] font-bold bg-orange-50 px-2 py-0.5 rounded-full">HIDDEN</span>}
            </div>
            <div className="flex items-center gap-3 text-[#b0a098] text-xs">
              {mainVar?.priceMoney && <span>{formatPrice(mainVar.priceMoney.amount)}</span>}
              {enrichment?.website_category && <span>• {enrichment.website_category}</span>}
              {!mainVar?.trackInventory && <span>• Made to order</span>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Show / Hide toggle — quick way to take an item off the public site
                without touching anything else. */}
            <button onClick={() => toggleVisibility(product)} title={isHidden ? "Show on website" : "Hide from website"}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                isHidden ? "bg-orange-50 text-orange-500 hover:bg-orange-100" : "bg-green-50 text-green-600 hover:bg-green-100"
              }`}>
              {isHidden ? "Show" : "Live"}
            </button>

            {/* Single Edit button — opens the unified modal with catalog +
                website + photo sections. Replaced the prior split flow
                where Edit and Details did different things. */}
            <button onClick={() => openEdit(product)}
              className="px-2.5 py-1.5 rounded-lg bg-[#E3F2FD] text-[#1976D2] text-[10px] font-bold hover:bg-[#BBDEFB] transition-colors">
              Edit
            </button>

            <button onClick={() => handleDelete(product.id)}
              className="px-2 py-1.5 rounded-lg bg-[#FFF9F4] text-[#c4b5aa] text-[10px] font-bold border border-[#e8ddd4] hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors">
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#5a3e36]">Products</h2>
          <p className="text-[#b0a098] text-sm">Manage products synced with Square POS</p>
        </div>
        <button onClick={() => setCreating(true)} className="bg-[#E8A0BF] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#d889ad] transition-colors">
          + New Product
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4">{error}</div>}

      {/* Status bar */}
      <div className="bg-white rounded-xl p-4 border border-[#f0e6de] mb-5 flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <p className="text-[#7a6a62] text-sm">
          <span className="font-semibold text-[#5a3e36]">Square connected</span> — Products sync to your POS automatically
        </p>
      </div>

      {/* Product List — split into Combos & Bundles vs Individual Products
          so Haley doesn't have to scroll past pricing-bundle SKUs to find
          the actual baked goods. The combo set is shared with the
          bestsellers homepage filter via lib/pos-bundles.ts so any rename
          stays in sync. */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#E8A0BF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#f0e6de]">
          <p className="text-[#7a6a62] mb-1">No products yet</p>
          <p className="text-[#b0a098] text-sm">Create your first product to get started</p>
        </div>
      ) : (
        <div className="space-y-8">
          {individualProducts.length > 0 && (
            <section>
              <h3 className="text-[#5a3e36] text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-base">🍪</span> Individual Products
                <span className="text-[#b0a098] text-xs font-normal normal-case tracking-normal">({individualProducts.length})</span>
              </h3>
              <div className="space-y-2">
                {individualProducts.map((p) => renderProductRow(p))}
              </div>
            </section>
          )}

          {comboProducts.length > 0 && (
            <section>
              <h3 className="text-[#5a3e36] text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-base">📦</span> Combos &amp; Bundles
                <span className="text-[#b0a098] text-xs font-normal normal-case tracking-normal">
                  ({comboProducts.length}) — POS-only pricing shortcuts; never appear in the public storefront
                </span>
              </h3>
              <div className="space-y-2">
                {comboProducts.map((p) => renderProductRow(p))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ===== CREATE MODAL ===== */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl p-7 border border-[#f0e6de] w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[#5a3e36] text-lg font-bold mb-5">New Product</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Product Name</label>
                <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className={inputClass} placeholder="Fudge Brownie" />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} rows={2} className={inputClass} placeholder="Rich and fudgy..." />
              </div>
              <div className="flex items-center justify-between bg-[#FFF9F4] rounded-xl p-3 border border-[#e8ddd4]">
                <div>
                  <p className="text-[#5a3e36] text-sm font-semibold">Track Inventory</p>
                  <p className="text-[#b0a098] text-xs">Off = made to order (no stock limit)</p>
                </div>
                <button onClick={() => setNewProduct({ ...newProduct, trackInventory: !newProduct.trackInventory })}
                  className={`w-11 h-6 rounded-full transition-colors relative ${newProduct.trackInventory ? "bg-[#E8A0BF]" : "bg-[#e0d5cc]"}`}>
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${newProduct.trackInventory ? "left-6" : "left-1"}`} />
                </button>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass}>Sizes / Pricing</label>
                  <button onClick={() => setNewProduct({ ...newProduct, variations: [...newProduct.variations, { name: "", price: 0, sku: "" }] })}
                    className="text-[#E8A0BF] text-xs font-bold hover:text-[#d889ad]">+ Add Size</button>
                </div>
                {newProduct.variations.map((v, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="text" value={v.name} onChange={(e) => { const vars = [...newProduct.variations]; vars[i].name = e.target.value; setNewProduct({ ...newProduct, variations: vars }); }}
                      className={`${inputClass} flex-1`} placeholder="Regular" />
                    <div className="relative w-24">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4b5aa] text-sm">$</span>
                      <input type="number" step="0.01" value={v.price || ""} onChange={(e) => { const vars = [...newProduct.variations]; vars[i].price = parseFloat(e.target.value) || 0; setNewProduct({ ...newProduct, variations: vars }); }}
                        className={`${inputClass} pl-7`} placeholder="0.00" />
                    </div>
                    {newProduct.variations.length > 1 && (
                      <button onClick={() => setNewProduct({ ...newProduct, variations: newProduct.variations.filter((_, idx) => idx !== i) })} className="text-[#c4b5aa] hover:text-red-400 px-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setCreating(false); setNewProduct({ ...emptyProduct }); }} className="flex-1 border border-[#e8ddd4] text-[#7a6a62] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#FFF9F4]">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !newProduct.name} className="flex-1 bg-[#E8A0BF] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#d889ad] disabled:opacity-50">
                {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== UNIFIED EDIT MODAL =====
          Single modal that edits BOTH Square catalog data (name, description,
          variations) AND Supabase website enrichment (extended desc,
          ingredients, badges, photos). Replaces the prior split where Edit
          and Details were separate buttons doing different things — Cole
          rightly noted that Details actually had more editable fields than
          Edit, which made the labels misleading.

          Both pieces of data are loaded together by openEdit() and saved
          together by handleSaveAll() in parallel. */}
      {editingProduct && editingEnrichment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeEdit}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl p-7 border border-[#f0e6de] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[#5a3e36] text-lg font-bold mb-1">Edit {editingProduct.name}</h3>
            <p className="text-[#b0a098] text-xs mb-5">Catalog data syncs to Square POS · Website fields + photos stay on bitemeprotein.com</p>

            <div className="space-y-6">

              {/* ── Section 1: Catalog (Square POS) ───────────────────────── */}
              <section>
                <h4 className="text-[#5a3e36] text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="text-base">📦</span> Catalog
                  <span className="text-[#b0a098] text-[10px] font-normal normal-case tracking-normal">Syncs to Square</span>
                </h4>
                <div className="space-y-3 bg-[#FFFCF7] rounded-xl p-4 border border-[#f0e6de]">
                  <div>
                    <label className={labelClass}>Product Name</label>
                    <input type="text" value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Square Description</label>
                    <textarea value={editingProduct.description} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} rows={2} className={inputClass} placeholder="Short description shown on Square receipts" />
                  </div>
                  <div>
                    <label className={labelClass}>Sizes / Pricing</label>
                    {editingProduct.variations.map((v, i) => (
                      <div key={v.id || i} className="flex gap-2 mb-2">
                        <input type="text" value={v.name} onChange={(e) => { const vars = [...editingProduct.variations]; vars[i] = { ...vars[i], name: e.target.value }; setEditingProduct({ ...editingProduct, variations: vars }); }}
                          className={`${inputClass} flex-1`} />
                        <div className="relative w-24">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4b5aa] text-sm">$</span>
                          <input type="number" step="0.01" value={v.priceMoney ? (v.priceMoney.amount / 100) : ""} onChange={(e) => { const vars = [...editingProduct.variations]; vars[i] = { ...vars[i], priceMoney: { amount: Math.round(parseFloat(e.target.value || "0") * 100), currency: "USD" } }; setEditingProduct({ ...editingProduct, variations: vars }); }}
                            className={`${inputClass} pl-7`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Section 2: Website (Supabase enrichments) ─────────────── */}
              <section>
                <h4 className="text-[#5a3e36] text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="text-base">✨</span> Website
                  <span className="text-[#b0a098] text-[10px] font-normal normal-case tracking-normal">Stays on bitemeprotein.com</span>
                </h4>
                <div className="space-y-3 bg-[#FFFCF7] rounded-xl p-4 border border-[#f0e6de]">
                  <div>
                    <label className={labelClass}>Website Description</label>
                    <textarea value={editingEnrichment.extended_description || ""} onChange={(e) => setEditingEnrichment({ ...editingEnrichment, extended_description: e.target.value })}
                      rows={3} className={inputClass} placeholder="A longer description for the product page..." />
                  </div>
                  <div>
                    <label className={labelClass}>Ingredients</label>
                    <textarea value={editingEnrichment.ingredients || ""} onChange={(e) => setEditingEnrichment({ ...editingEnrichment, ingredients: e.target.value })}
                      rows={2} className={inputClass} placeholder="Gluten-free · Low sugar · No nuts" />
                  </div>
                  <div>
                    <label className={labelClass}>Nutrition Summary</label>
                    <input type="text" value={editingEnrichment.nutrition_info || ""} onChange={(e) => setEditingEnrichment({ ...editingEnrichment, nutrition_info: e.target.value })}
                      className={inputClass} placeholder="~18g protein per serving" />
                  </div>
                  <div>
                    <label className={labelClass}>Cost Per Item (your cost to make)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4b5aa] text-sm">$</span>
                      <input type="number" step="0.01" value={editingEnrichment.cost_per_item_cents ? (editingEnrichment.cost_per_item_cents / 100).toFixed(2) : ""}
                        onChange={(e) => setEditingEnrichment({ ...editingEnrichment, cost_per_item_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                        className={`${inputClass} pl-7`} placeholder="0.00" />
                    </div>
                    <p className="text-[#b0a098] text-xs mt-1">Used for profit calculations in Accounting</p>
                  </div>
                  <div>
                    <label className={labelClass}>Category</label>
                    <select value={editingEnrichment.website_category || ""} onChange={(e) => setEditingEnrichment({ ...editingEnrichment, website_category: e.target.value || null })}
                      className={inputClass}>
                      <option value="">None</option>
                      {CATEGORY_OPTIONS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Badges</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {BADGE_OPTIONS.map((badge) => {
                        const active = editingEnrichment.badges.includes(badge);
                        return (
                          <button key={badge} onClick={() => {
                            const newBadges = active ? editingEnrichment.badges.filter((b) => b !== badge) : [...editingEnrichment.badges, badge];
                            setEditingEnrichment({ ...editingEnrichment, badges: newBadges });
                          }} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            active ? "bg-[#E8A0BF] text-white" : "bg-white text-[#7a6a62] border border-[#e8ddd4] hover:border-[#E8A0BF]"
                          }`}>{badge}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-[#e8ddd4]">
                    <div>
                      <p className="text-[#5a3e36] text-sm font-semibold">Show on Website</p>
                      <p className="text-[#b0a098] text-xs">Turn off to hide without deleting</p>
                    </div>
                    <button onClick={() => setEditingEnrichment({ ...editingEnrichment, is_visible: !editingEnrichment.is_visible })}
                      className={`w-11 h-6 rounded-full transition-colors relative ${editingEnrichment.is_visible ? "bg-green-400" : "bg-[#e0d5cc]"}`}>
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${editingEnrichment.is_visible ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                </div>
              </section>

              {/* ── Section 3: Photos ─────────────────────────────────────
                  Photos save autonomously inside ProductImageManager
                  (optimistic UI on upload/reorder/delete) — they don't go
                  through the modal's Save button. That keeps a long photo
                  upload from blocking the rest of the form. */}
              <section>
                <h4 className="text-[#5a3e36] text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="text-base">📸</span> Photos
                  <span className="text-[#b0a098] text-[10px] font-normal normal-case tracking-normal">Save automatically — no need to hit Save below</span>
                </h4>
                <div className="bg-[#FFFCF7] rounded-xl p-4 border border-[#f0e6de]">
                  {/* Pass BOTH the Square catalog id AND a derived legacy
                      slug (e.g. chocChipBananaBread). The slug bridges this
                      admin UI to existing public-site image lookups in
                      lib/images.ts + product_images.slug rows, so newly
                      uploaded photos appear on the storefront immediately
                      instead of getting stranded under just the catalog id. */}
                  <ProductImageManager
                    squareProductId={editingEnrichment.square_catalog_id}
                    productName={editingProduct.name}
                    slug={slugForProductName(editingProduct.name)}
                  />
                </div>
              </section>

            </div>

            <div className="flex gap-3 mt-6 sticky bottom-0 bg-white pt-4 border-t border-[#f0e6de]">
              <button onClick={closeEdit} className="flex-1 border border-[#e8ddd4] text-[#7a6a62] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#FFF9F4]">Cancel</button>
              <button onClick={handleSaveAll} disabled={saving} className="flex-1 bg-[#E8A0BF] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#d889ad] disabled:opacity-50">
                {saving ? "Saving..." : "Save All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
