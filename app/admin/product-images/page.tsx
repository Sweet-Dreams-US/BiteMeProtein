"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProductImageManager from "@/components/admin/ProductImageManager";

interface SquareProduct {
  id: string;
  name: string | null;
}

interface SlugStats {
  slug: string;
  count: number;
}

/**
 * /admin/product-images
 *
 * One place to manage every product's images. Two sources of truth for
 * product identity during the transition:
 *   1. square_products — real products synced from Square (sub-project 2)
 *   2. product_images rows whose slug is set but square_product_id is null
 *      — seed data carrying forward the legacy lib/images.ts mapping.
 *
 * Pick a product from either list → ProductImageManager renders upload +
 * reorder + delete.
 */
export default function AdminProductImagesPage() {
  const [products, setProducts] = useState<SquareProduct[]>([]);
  const [orphanSlugs, setOrphanSlugs] = useState<SlugStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ kind: "product"; id: string; name: string } | { kind: "slug"; slug: string } | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [productsRes, imagesRes] = await Promise.all([
      supabase.from("square_products").select("id, name").eq("is_archived", false).order("name"),
      supabase.from("product_images").select("slug, square_product_id"),
    ]);

    setProducts((productsRes.data ?? []) as SquareProduct[]);

    // Find slugs that have images but no linked square_product_id
    const slugCounts: Record<string, number> = {};
    for (const row of imagesRes.data ?? []) {
      if (!row.square_product_id && row.slug) {
        slugCounts[row.slug] = (slugCounts[row.slug] ?? 0) + 1;
      }
    }
    setOrphanSlugs(Object.entries(slugCounts).map(([slug, count]) => ({ slug, count })).sort((a, b) => a.slug.localeCompare(b.slug)));

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.name ?? "").toLowerCase().includes(q));
  }, [products, search]);

  const filteredSlugs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orphanSlugs;
    return orphanSlugs.filter((s) => s.slug.toLowerCase().includes(q));
  }, [orphanSlugs, search]);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#5a3e36]">Product images</h1>
        <p className="text-[#b0a098] text-sm mt-1">Upload, reorder, and caption product photography. Changes reflect on the public site immediately.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left: picker */}
        <aside className="space-y-4">
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#e8ddd4] rounded-lg px-3 py-2 text-sm"
          />

          {loading ? (
            <p className="text-[#b0a098] text-xs">Loading…</p>
          ) : (
            <>
              <section className="bg-white rounded-xl border border-[#f0e6de] p-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#7a6a62] mb-2">Square products</h3>
                {filteredProducts.length === 0 ? (
                  <p className="text-[11px] text-[#b0a098] italic">
                    {products.length === 0 ? "No products synced yet. Run backfill after sub-project 2 merges." : "No matches."}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {filteredProducts.map((p) => {
                      const isSelected = selected?.kind === "product" && selected.id === p.id;
                      return (
                        <li key={p.id}>
                          <button
                            onClick={() => setSelected({ kind: "product", id: p.id, name: p.name ?? p.id })}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              isSelected ? "bg-[#FCE4EC] text-[#c2185b] font-semibold" : "text-[#5a3e36] hover:bg-[#FFF5EE]"
                            }`}
                          >
                            {p.name ?? p.id}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {orphanSlugs.length > 0 && (
                <section className="bg-white rounded-xl border border-[#f0e6de] p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#7a6a62] mb-1">Legacy slugs</h3>
                  <p className="text-[10px] text-[#b0a098] italic mb-2">Seeded image groups not yet linked to a Square product.</p>
                  {filteredSlugs.length === 0 ? (
                    <p className="text-[11px] text-[#b0a098] italic">No matches.</p>
                  ) : (
                    <ul className="space-y-1">
                      {filteredSlugs.map((s) => {
                        const isSelected = selected?.kind === "slug" && selected.slug === s.slug;
                        return (
                          <li key={s.slug}>
                            <button
                              onClick={() => setSelected({ kind: "slug", slug: s.slug })}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                                isSelected ? "bg-[#FCE4EC] text-[#c2185b] font-semibold" : "text-[#5a3e36] hover:bg-[#FFF5EE]"
                              }`}
                            >
                              <span className="font-mono text-xs">{s.slug}</span>
                              <span className="text-[10px] text-[#b0a098]">{s.count}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}
            </>
          )}
        </aside>

        {/* Right: image manager */}
        <main className="bg-white rounded-2xl border border-[#f0e6de] shadow-sm p-6 min-h-[400px]">
          {!selected ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-[#b0a098] text-sm italic">Select a product or slug on the left to manage its images.</p>
            </div>
          ) : selected.kind === "product" ? (
            <>
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-wider text-[#b0a098]">Square product</p>
                <h2 className="text-lg font-semibold text-[#5a3e36]">{selected.name}</h2>
                <p className="text-[10px] text-[#b0a098] font-mono">{selected.id}</p>
              </div>
              <ProductImageManager squareProductId={selected.id} />
            </>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-wider text-[#b0a098]">Legacy slug</p>
                <h2 className="text-lg font-semibold text-[#5a3e36] font-mono">{selected.slug}</h2>
                <p className="text-[10px] text-[#b0a098] mt-1">Once the matching Square product is synced, images can be re-linked to its product id.</p>
              </div>
              <ProductImageManager slug={selected.slug} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
