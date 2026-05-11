import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log-error";
import { POS_ONLY_BUNDLE_NAMES } from "@/lib/pos-bundles";
import { slugForProductName } from "@/lib/product-slugs";

/**
 * GET /api/bestsellers?limit=10
 *
 * Returns products ranked by units sold, aggregated from
 * square_order_line_items (synced in sub-project 2 from every Square sale,
 * POS + online). Each row also includes an image URL discovered via three
 * fallbacks (most specific first):
 *   1. product_images.square_product_id match
 *      (variation.catalog_object_id → variation.product_id → product_images)
 *   2. product_images slug fuzzy-matched against the order line name
 *   3. null (caller can show a placeholder)
 *
 * Public endpoint — only aggregate data leaves. Individual orders + PII
 * stay locked behind RLS.
 *
 * Shape:
 *   { items: Array<{
 *       name, total_sold, square_product_id, image_url, image_alt
 *     }>,
 *     source: "sales" | "empty" }
 *
 * When no line items exist yet (new site / pre-backfill), returns
 * { items: [], source: "empty" } so the caller can fall back to its own
 * default ordering.
 */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface ProductImageRow {
  slug: string | null;
  square_product_id: string | null;
  url: string;
  alt: string | null;
  kind: string;
  sort_order: number;
}

/**
 * Fuzzy match: returns true if the product name and image slug share at
 * least one meaningful word. Slugs like "brownieHearts" get camelCase
 * split into ["brownie", "hearts"] so that "Protein Brownies" matches.
 */
function slugMatchesName(name: string, slug: string): boolean {
  const nameWords = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  const slugWords = slug
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  if (nameWords.length === 0 || slugWords.length === 0) return false;
  return nameWords.some((nw) => slugWords.some((sw) => sw.startsWith(nw) || nw.startsWith(sw)));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit") ?? 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 10, 1), 50);

    const supabase = getServiceClient();

    const [lineItemsRes, variationsRes, productImagesRes, pinnedRes] = await Promise.all([
      supabase
        .from("square_order_line_items")
        .select("name, catalog_object_id, quantity")
        .not("name", "is", null)
        .limit(50_000),
      supabase.from("square_product_variations").select("id, product_id"),
      supabase
        .from("product_images")
        .select("slug, square_product_id, url, alt, kind, sort_order")
        .eq("kind", "product")
        .order("sort_order", { ascending: true }),
      // Pinned bestsellers — admin override. Coming-soon items are
      // excluded since they're not buyable yet (no point teasing them in
      // the bestseller carousel when the buy button is disabled).
      supabase
        .from("product_enrichments")
        .select("square_catalog_id, product_name")
        .eq("is_bestseller_override", true)
        .eq("coming_soon", false)
        .eq("is_visible", true),
    ]);

    if (lineItemsRes.error) {
      await logError(lineItemsRes.error, { path: "/api/bestsellers:lineItems", source: "api-route" });
      return NextResponse.json({ error: lineItemsRes.error.message }, { status: 500 });
    }

    const lineItems = (lineItemsRes.data ?? []) as Array<{
      name: string;
      catalog_object_id: string | null;
      quantity: string | null;
    }>;

    if (lineItems.length === 0) {
      return NextResponse.json({ items: [], source: "empty" });
    }

    // variation.id → variation.product_id
    const variationToProduct = new Map<string, string>();
    for (const v of (variationsRes.data ?? []) as Array<{ id: string; product_id: string }>) {
      if (v.id && v.product_id) variationToProduct.set(v.id, v.product_id);
    }

    // Pre-index product_images by square_product_id and by slug so lookup
    // is O(1) per bestseller instead of re-scanning every time.
    const imagesByProductId = new Map<string, ProductImageRow>();
    const imagesBySlug = new Map<string, ProductImageRow>();
    for (const img of (productImagesRes.data ?? []) as ProductImageRow[]) {
      if (img.square_product_id && !imagesByProductId.has(img.square_product_id)) {
        imagesByProductId.set(img.square_product_id, img);
      }
      if (img.slug && !imagesBySlug.has(img.slug)) {
        imagesBySlug.set(img.slug, img);
      }
    }
    const allSlugImages = Array.from(imagesBySlug.values());

    // Aggregate by (name, catalog_object_id). Same product name across
    // multiple variations still aggregates under the name for display, but
    // we remember a representative variation id so we can resolve images.
    interface Agg {
      name: string;
      total_sold: number;
      firstVariationId: string | null;
    }
    const agg = new Map<string, Agg>();
    for (const row of lineItems) {
      const qty = Number(row.quantity ?? "0") || 0;
      const name = row.name.trim();
      if (!name) continue;
      const existing = agg.get(name);
      if (existing) {
        existing.total_sold += qty;
        if (!existing.firstVariationId && row.catalog_object_id) {
          existing.firstVariationId = row.catalog_object_id;
        }
      } else {
        agg.set(name, {
          name,
          total_sold: qty,
          firstVariationId: row.catalog_object_id ?? null,
        });
      }
    }

    // POS-only line names that aren't real catalog products — Haley uses
    // these as Square POS shortcut buttons for bundle pricing at events.
    // Without this filter they dominate the bestseller list (they're rung
    // up more than any single product) but render as gradient placeholders
    // on the homepage because they have no images and no real catalog row.
    // Shared with /admin/products grouping (see lib/pos-bundles.ts).

    const items = Array.from(agg.values())
      // Filter out POS-only bundle items by exact name match. Cheap and
      // surgical — doesn't touch real product names that happen to share
      // a digit (e.g., "2x Brownies" wouldn't accidentally match).
      .filter((row) => !POS_ONLY_BUNDLE_NAMES.has(row.name))
      .sort((a, b) => b.total_sold - a.total_sold)
      .map((row) => {
        // 1. variation → product → product_images by square_product_id
        let image: ProductImageRow | undefined;
        let productId: string | null = null;
        if (row.firstVariationId) {
          productId = variationToProduct.get(row.firstVariationId) ?? null;
          if (productId) image = imagesByProductId.get(productId);
        }
        // 2. EXACT slug lookup via the known-product-name map. Critical for
        //    disambiguating products whose names share fuzzy-matchable words:
        //    "Raspberry Chocolate Chip Protein Banana Bread Bites" shares
        //    "chip", "banana", "bread" with "Chocolate Chip Protein Banana
        //    Bread Bites", so the loose fuzzy match below was returning
        //    whichever slug happened to appear first. The exact lookup
        //    short-circuits before fuzzy can pick the wrong one.
        if (!image) {
          const exactSlug = slugForProductName(row.name);
          if (exactSlug) {
            image = allSlugImages.find((img) => img.slug === exactSlug);
          }
        }
        // 3. slug fuzzy match on the order line name (last resort for
        //    products not in the known map — typically new/unmapped items)
        if (!image) {
          image = allSlugImages.find((img) => img.slug && slugMatchesName(row.name, img.slug));
        }

        return {
          name: row.name,
          total_sold: row.total_sold,
          square_product_id: productId,
          image_url: image?.url ?? null,
          image_alt: image?.alt ?? null,
        };
      })
      // Drop items that didn't resolve to an image. Two reasons:
      //   1. Without a photo the homepage card is just a gradient — looks
      //      like a broken placeholder.
      //   2. Anything we couldn't match to product_images probably isn't a
      //      real catalog product anyway (custom POS button, voided line,
      //      etc.) — same class of noise as the bundle filter above.
      .filter((row) => row.image_url !== null);

    // ── Admin-pinned bestsellers ───────────────────────────────────────
    // Build cards for products that have is_bestseller_override=true.
    // Each pinned card needs a product name + an image. We resolve the
    // image via:
    //   1. square_product_id → product_images (most precise)
    //   2. exact slug from product_name → product_images (fallback)
    // If neither resolves, drop the pin (no image = no card, same as
    // sales-ranked items).
    const pinned: Array<{
      name: string;
      total_sold: number;
      square_product_id: string | null;
      image_url: string | null;
      image_alt: string | null;
    }> = [];
    const pinnedRows = (pinnedRes.data ?? []) as Array<{
      square_catalog_id: string;
      product_name: string | null;
    }>;
    for (const p of pinnedRows) {
      if (!p.product_name) continue;
      let image = imagesByProductId.get(p.square_catalog_id);
      if (!image) {
        const slug = slugForProductName(p.product_name);
        if (slug) image = allSlugImages.find((img) => img.slug === slug);
      }
      if (!image) continue;
      pinned.push({
        name: p.product_name,
        // total_sold isn't meaningful for a manual pin — use 0 so the UI
        // can choose to hide the badge if it wants, but the value is
        // still present for typing consistency.
        total_sold: 0,
        square_product_id: p.square_catalog_id,
        image_url: image.url,
        image_alt: image.alt ?? null,
      });
    }

    // Merge: pinned first (in catalog order), then sales-ranked tail,
    // deduped by name so a product that's both pinned AND a real bestseller
    // shows once at the top.
    const seenNames = new Set(pinned.map((p) => p.name));
    const merged = [
      ...pinned,
      ...items.filter((row) => !seenNames.has(row.name)),
    ].slice(0, limit);

    return NextResponse.json({ items: merged, source: "sales" });
  } catch (err) {
    await logError(err, { path: "/api/bestsellers", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to load bestsellers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
