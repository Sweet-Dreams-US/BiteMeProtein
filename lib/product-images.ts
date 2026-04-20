"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface ProductImage {
  id: string;
  square_product_id: string | null;
  slug: string | null;
  url: string;
  kind: "product" | "nutrition" | "lifestyle";
  alt: string | null;
  sort_order: number;
}

type UseProductImagesOpts = {
  slug?: string;
  squareProductId?: string;
  kind?: ProductImage["kind"];
};

/**
 * useProductImages — fetch images for a product.
 *
 * Pass EITHER a slug (seed/legacy) or squareProductId. Returns a sorted
 * array. Optional kind filter (default: all kinds).
 */
export function useProductImages(opts: UseProductImagesOpts): {
  images: ProductImage[];
  loading: boolean;
} {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase.from("product_images").select("*").order("sort_order", { ascending: true });
      if (opts.slug) query = query.eq("slug", opts.slug);
      if (opts.squareProductId) query = query.eq("square_product_id", opts.squareProductId);
      if (opts.kind) query = query.eq("kind", opts.kind);

      const { data, error } = await query;
      if (cancelled) return;
      if (!error && data) setImages(data as ProductImage[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [opts.slug, opts.squareProductId, opts.kind]);

  return { images, loading };
}

/**
 * useProductImagesBySlugs — batch lookup.
 * Returns a map: slug → ProductImage[], sorted.
 */
export function useProductImagesBySlugs(
  slugs: string[],
  kind?: ProductImage["kind"],
): { bySlug: Record<string, ProductImage[]>; loading: boolean } {
  const [bySlug, setBySlug] = useState<Record<string, ProductImage[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (slugs.length === 0) { setBySlug({}); setLoading(false); return; }
      let query = supabase
        .from("product_images")
        .select("*")
        .in("slug", slugs)
        .order("sort_order", { ascending: true });
      if (kind) query = query.eq("kind", kind);

      const { data, error } = await query;
      if (cancelled) return;

      const grouped: Record<string, ProductImage[]> = {};
      if (!error && data) {
        for (const img of data as ProductImage[]) {
          if (!img.slug) continue;
          (grouped[img.slug] ||= []).push(img);
        }
      }
      setBySlug(grouped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugs.join(","), kind]);

  return { bySlug, loading };
}
