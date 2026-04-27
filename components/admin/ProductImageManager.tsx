"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-fetch";
import type { ProductImage } from "@/lib/product-images";

/**
 * ProductImageManager — image upload + reorder + delete for one product.
 *
 * Upload flow:
 *   1. File selected → client uploads directly to Supabase Storage bucket
 *      productPhotos under a dated path.
 *   2. On success, public URL is fetched.
 *   3. POST /api/admin/product-images attaches the URL to the product.
 *
 * Identifiers: pass EITHER `slug` (legacy / pre-sync) or `squareProductId`
 * (recommended when the product has been synced into square_products).
 */

interface Props {
  squareProductId?: string;
  slug?: string;
  label?: string;
}

const BUCKET = "productPhotos";

export default function ProductImageManager({ squareProductId, slug, label }: Props) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let q = supabase.from("product_images").select("*").order("sort_order", { ascending: true });

    // Show images keyed by EITHER identifier so admins see legacy
    // slug-keyed photos alongside any newly-uploaded square_product_id-
    // keyed ones. Existing public-site photos were all written with slug
    // before the catalog sync existed; uploads from this admin attach
    // both so they show up everywhere.
    if (squareProductId && slug) {
      q = q.or(`square_product_id.eq.${squareProductId},slug.eq.${slug}`);
    } else if (squareProductId) {
      q = q.eq("square_product_id", squareProductId);
    } else if (slug) {
      q = q.eq("slug", slug);
    } else {
      setImages([]);
      setLoading(false);
      return;
    }

    const { data, error: queryErr } = await q;
    if (queryErr) setError(queryErr.message);
    else setImages((data ?? []) as ProductImage[]);
    setLoading(false);
  }, [squareProductId, slug]);

  useEffect(() => { load(); }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");

    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `uploads/${Date.now()}_${safe}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: "31536000", upsert: false });
        if (uploadErr) throw uploadErr;

        const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);

        const nextSort = (images[images.length - 1]?.sort_order ?? -1) + 1 + images.length;

        const res = await adminFetch("/api/admin/product-images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            squareProductId,
            slug,
            url: publicData.publicUrl,
            kind: "product",
            sort_order: nextSort,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Attach failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateKind = async (id: string, kind: ProductImage["kind"]) => {
    // Save kind change via direct Supabase update (RLS allows admin write).
    const { error: updateErr } = await supabase.from("product_images").update({ kind }).eq("id", id);
    if (updateErr) { setError(updateErr.message); return; }
    load();
  };

  const updateAlt = async (id: string, alt: string) => {
    const { error: updateErr } = await supabase.from("product_images").update({ alt: alt || null }).eq("id", id);
    if (updateErr) { setError(updateErr.message); return; }
  };

  const move = async (id: string, direction: -1 | 1) => {
    const idx = images.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= images.length) return;
    const a = images[idx];
    const b = images[swapIdx];

    const res = await adminFetch("/api/admin/product-images", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        updates: [
          { id: a.id, sort_order: b.sort_order },
          { id: b.id, sort_order: a.sort_order },
        ],
      }),
    });
    if (!res.ok) { const json = await res.json().catch(() => ({})); setError(json.error ?? "Reorder failed"); return; }
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this image from the product?")) return;
    const res = await adminFetch(`/api/admin/product-images?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) { const json = await res.json().catch(() => ({})); setError(json.error ?? "Delete failed"); return; }
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[#5a3e36] font-semibold text-sm">{label ?? "Images"}</h4>
        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-[#E8A0BF] text-white rounded-lg hover:bg-[#d889ad] transition-colors">
          {uploading ? "Uploading…" : "+ Upload"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      {loading ? (
        <p className="text-[#b0a098] text-xs">Loading…</p>
      ) : images.length === 0 ? (
        <p className="text-[#b0a098] text-xs italic">No images yet. Upload one to get started.</p>
      ) : (
        <ul className="space-y-2">
          {images.map((img, i) => (
            <li key={img.id} className="flex items-center gap-3 bg-[#FFF5EE] rounded-lg p-2">
              <div className="relative shrink-0 w-16 h-16 rounded-md overflow-hidden bg-white border border-[#f0e6de]">
                {/* Plain img — keeps this admin-only component independent of next.config.ts remotePatterns */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt ?? ""} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <select
                    value={img.kind}
                    onChange={(e) => updateKind(img.id, e.target.value as ProductImage["kind"])}
                    className="text-xs bg-white border border-[#e8ddd4] rounded px-1.5 py-0.5"
                  >
                    <option value="product">product</option>
                    <option value="nutrition">nutrition</option>
                    <option value="lifestyle">lifestyle</option>
                  </select>
                  <input
                    type="text"
                    defaultValue={img.alt ?? ""}
                    onBlur={(e) => updateAlt(img.id, e.target.value)}
                    placeholder="alt text"
                    className="flex-1 text-xs bg-white border border-[#e8ddd4] rounded px-2 py-0.5"
                  />
                </div>
                <p className="text-[10px] text-[#b0a098] mt-1 truncate font-mono">{img.url}</p>
              </div>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => move(img.id, -1)} disabled={i === 0} className="text-xs text-[#7a6a62] hover:text-[#5a3e36] disabled:opacity-30">↑</button>
                <button onClick={() => move(img.id, 1)} disabled={i === images.length - 1} className="text-xs text-[#7a6a62] hover:text-[#5a3e36] disabled:opacity-30">↓</button>
              </div>
              <button onClick={() => remove(img.id)} className="shrink-0 text-xs text-[#b0a098] hover:text-red-500 px-2">✕</button>
            </li>
          ))}
        </ul>
      )}

      {(squareProductId || slug) && (
        <p className="text-[10px] text-[#b0a098] mt-1">
          Attached to: <code className="font-mono">{squareProductId ? `product_id=${squareProductId.slice(0, 8)}…` : `slug=${slug}`}</code>
        </p>
      )}
    </div>
  );
}
