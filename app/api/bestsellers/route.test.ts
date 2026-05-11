import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

/* eslint-disable @typescript-eslint/no-explicit-any */

// Per-table fixture + builder. The route issues four parallel queries
// against square_order_line_items, square_product_variations,
// product_images, and product_enrichments — each with different chain
// shapes. The enrichments path is for admin-pinned bestsellers.
const tableData = vi.hoisted(() => ({
  line_items: { data: [] as any[] | null, error: null as any },
  variations: { data: [] as any[] | null, error: null as any },
  product_images: { data: [] as any[] | null, error: null as any },
  enrichments: { data: [] as any[] | null, error: null as any },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      if (table === "square_order_line_items") {
        return {
          select: () => ({
            not: () => ({
              limit: () => Promise.resolve(tableData.line_items),
            }),
          }),
        };
      }
      if (table === "square_product_variations") {
        return {
          select: () => Promise.resolve(tableData.variations),
        };
      }
      if (table === "product_images") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve(tableData.product_images),
            }),
          }),
        };
      }
      if (table === "product_enrichments") {
        // Three chained .eq() calls in the route — return the same data
        // at any depth so each .eq() resolves to a thenable.
        const result = Promise.resolve(tableData.enrichments);
        const chain: any = {
          eq: () => chain,
          then: (resolve: any, reject: any) => result.then(resolve, reject),
        };
        return {
          select: () => chain,
        };
      }
      throw new Error(`unmocked table: ${table}`);
    },
  }),
}));

import { GET } from "./route";

function req(url: string, init: any = {}): NextRequest {
  return new NextRequest(url, init);
}

function reset() {
  tableData.line_items = { data: [], error: null };
  tableData.variations = { data: [], error: null };
  tableData.product_images = { data: [], error: null };
  tableData.enrichments = { data: [], error: null };
}

describe("app/api/bestsellers GET", () => {
  beforeEach(() => reset());

  it("returns empty + source='empty' when no line items exist", async () => {
    const res = await GET(req("http://localhost/api/bestsellers"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.source).toBe("empty");
  });

  it("aggregates by name and sorts by total_sold desc", async () => {
    tableData.line_items = {
      data: [
        { name: "Protein Brownies", catalog_object_id: "VAR_BROWNIE", quantity: "2" },
        { name: "Protein Brownies", catalog_object_id: "VAR_BROWNIE", quantity: "6" },
        { name: "Blueberry Protein Muffin", catalog_object_id: "VAR_MUFFIN", quantity: "1" },
        { name: "Protein Brownies", catalog_object_id: "VAR_BROWNIE", quantity: "1" },
        { name: "Blueberry Protein Muffin", catalog_object_id: "VAR_MUFFIN", quantity: "3" },
      ],
      error: null,
    };
    // Provide slug-fuzzy-matchable images so both items pass the
    // "must have an image" filter the route applies to keep the homepage
    // free of gradient placeholders.
    tableData.product_images = {
      data: [
        { slug: "brownieHearts", square_product_id: null, url: "https://fake/brownie.jpg", alt: "Brownie", kind: "product", sort_order: 0 },
        { slug: "blueberryMuffin", square_product_id: null, url: "https://fake/muffin.jpg", alt: "Muffin", kind: "product", sort_order: 0 },
      ],
      error: null,
    };
    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    expect(body.source).toBe("sales");
    expect(body.items[0]).toMatchObject({ name: "Protein Brownies", total_sold: 9 });
    expect(body.items[1]).toMatchObject({ name: "Blueberry Protein Muffin", total_sold: 4 });
  });

  it("resolves image via variation → product → product_images", async () => {
    tableData.line_items = {
      data: [{ name: "Protein Brownies", catalog_object_id: "VAR_1", quantity: "5" }],
      error: null,
    };
    tableData.variations = { data: [{ id: "VAR_1", product_id: "PROD_A" }], error: null };
    tableData.product_images = {
      data: [
        { slug: null, square_product_id: "PROD_A", url: "https://fake/linked.jpg", alt: "Linked", kind: "product", sort_order: 0 },
      ],
      error: null,
    };

    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    expect(body.items[0]).toMatchObject({
      name: "Protein Brownies",
      square_product_id: "PROD_A",
      image_url: "https://fake/linked.jpg",
      image_alt: "Linked",
    });
  });

  it("falls back to slug fuzzy-match when no square_product_id is linked", async () => {
    tableData.line_items = {
      data: [{ name: "Protein Brownies", catalog_object_id: "VAR_1", quantity: "3" }],
      error: null,
    };
    tableData.variations = { data: [{ id: "VAR_1", product_id: "PROD_A" }], error: null };
    tableData.product_images = {
      data: [
        { slug: "brownieHearts", square_product_id: null, url: "https://fake/brownie.jpg", alt: "Brownie", kind: "product", sort_order: 0 },
        { slug: "blueberryMuffin", square_product_id: null, url: "https://fake/muffin.jpg", alt: "Muffin", kind: "product", sort_order: 0 },
      ],
      error: null,
    };

    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    expect(body.items[0].image_url).toBe("https://fake/brownie.jpg");
  });

  it("filters out items with no resolvable image (avoids gradient placeholders on homepage)", async () => {
    tableData.line_items = {
      data: [
        { name: "Totally Unique Product", catalog_object_id: null, quantity: "10" },
        { name: "Protein Brownies", catalog_object_id: null, quantity: "1" },
      ],
      error: null,
    };
    tableData.product_images = {
      data: [{ slug: "brownieHearts", square_product_id: null, url: "https://fake/brownie.jpg", alt: null, kind: "product", sort_order: 0 }],
      error: null,
    };

    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    // Only the brownie comes through; the unmatched item is dropped
    // even though it sold more, because it would render as a gradient.
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ name: "Protein Brownies" });
  });

  it("filters out POS-only bundle names (Trainer Deal, 2 For 10, etc.)", async () => {
    tableData.line_items = {
      data: [
        { name: "Trainer Deal", catalog_object_id: null, quantity: "21" },
        { name: "2 For 10", catalog_object_id: null, quantity: "19" },
        { name: "Protein Brownies", catalog_object_id: null, quantity: "3" },
      ],
      error: null,
    };
    tableData.product_images = {
      data: [{ slug: "brownieHearts", square_product_id: null, url: "https://fake/brownie.jpg", alt: null, kind: "product", sort_order: 0 }],
      error: null,
    };

    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    // Even though Trainer Deal + 2 For 10 outsold brownies, they're
    // explicit POS-only bundle names — never surface on the homepage.
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Protein Brownies");
  });

  it("respects ?limit and clamps to [1, 50]", async () => {
    tableData.line_items = {
      data: [
        { name: "Brownie Alpha", catalog_object_id: null, quantity: "5" },
        { name: "Muffin Beta", catalog_object_id: null, quantity: "3" },
        { name: "Truffle Gamma", catalog_object_id: null, quantity: "1" },
      ],
      error: null,
    };
    // Slug-fuzzy-matchable images for all three so the no-image filter
    // doesn't drop them — limit logic is what's being tested. slugMatchesName
    // requires ≥4-char word matches between name + slug.
    tableData.product_images = {
      data: [
        { slug: "brownieHearts", square_product_id: null, url: "https://fake/a.jpg", alt: null, kind: "product", sort_order: 0 },
        { slug: "muffin", square_product_id: null, url: "https://fake/b.jpg", alt: null, kind: "product", sort_order: 0 },
        { slug: "truffle", square_product_id: null, url: "https://fake/c.jpg", alt: null, kind: "product", sort_order: 0 },
      ],
      error: null,
    };
    const res = await GET(req("http://localhost/api/bestsellers?limit=2"));
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].name).toBe("Brownie Alpha");
    expect(body.items[1].name).toBe("Muffin Beta");
  });

  it("treats non-numeric quantity as 0", async () => {
    tableData.line_items = {
      data: [
        { name: "Weird Brownie Item", catalog_object_id: null, quantity: "not-a-number" },
        { name: "Weird Brownie Item", catalog_object_id: null, quantity: null },
        { name: "Real Brownie Item", catalog_object_id: null, quantity: "3" },
      ],
      error: null,
    };
    // Slug-matchable image so both pass the image filter — we're testing
    // quantity parsing here, not the image gate.
    tableData.product_images = {
      data: [{ slug: "brownieHearts", square_product_id: null, url: "https://fake/b.jpg", alt: null, kind: "product", sort_order: 0 }],
      error: null,
    };
    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    expect(body.items[0]).toMatchObject({ name: "Real Brownie Item", total_sold: 3 });
    expect(body.items[1]).toMatchObject({ name: "Weird Brownie Item", total_sold: 0 });
  });

  it("returns 500 when the line-items query errors", async () => {
    tableData.line_items = { data: null, error: { message: "db down" } };
    const res = await GET(req("http://localhost/api/bestsellers"));
    expect(res.status).toBe(500);
  });

  it("skips rows with empty or whitespace names", async () => {
    tableData.line_items = {
      data: [
        { name: "   ", catalog_object_id: null, quantity: "100" },
        { name: "", catalog_object_id: null, quantity: "50" },
        { name: "Real Brownie", catalog_object_id: null, quantity: "1" },
      ],
      error: null,
    };
    tableData.product_images = {
      data: [{ slug: "brownieHearts", square_product_id: null, url: "https://fake/b.jpg", alt: null, kind: "product", sort_order: 0 }],
      error: null,
    };
    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    expect(body.items).toEqual([
      expect.objectContaining({ name: "Real Brownie", total_sold: 1 }),
    ]);
  });

  // ── Exact slug lookup via lib/product-slugs.ts ──────────────────────
  // Regression for the bug where "Raspberry Chocolate Chip Protein Banana
  // Bread Bites" was getting paired with the chocChipBananaBread photo
  // because both slugs share the 4-char words "chip", "banana", "bread"
  // and fuzzy match returned whichever came first.
  it("disambiguates similarly-named products via exact slug lookup before fuzzy fallback", async () => {
    tableData.line_items = {
      data: [
        { name: "Raspberry Chocolate Chip Protein Banana Bread Bites", catalog_object_id: null, quantity: "5" },
        { name: "Chocolate Chip Protein Banana Bread Bites", catalog_object_id: null, quantity: "3" },
      ],
      error: null,
    };
    tableData.product_images = {
      // Intentionally put chocChipBananaBread FIRST in the list so a fuzzy
      // .find() would return it for both names — the exact-slug step has
      // to beat the fuzzy step to surface the right photo per product.
      data: [
        { slug: "chocChipBananaBread", square_product_id: null, url: "https://fake/choc.jpg", alt: "Choc Chip", kind: "product", sort_order: 0 },
        { slug: "rasChocChipBananaBread", square_product_id: null, url: "https://fake/raspberry.jpg", alt: "Raspberry", kind: "product", sort_order: 1 },
      ],
      error: null,
    };
    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    const raspberry = body.items.find((i: { name: string }) => i.name.startsWith("Raspberry"));
    const chocChip = body.items.find((i: { name: string }) => i.name.startsWith("Chocolate"));
    expect(raspberry.image_url).toBe("https://fake/raspberry.jpg");
    expect(chocChip.image_url).toBe("https://fake/choc.jpg");
  });

  // ── Admin-pinned bestsellers (is_bestseller_override) ───────────────
  it("prepends pinned bestsellers from product_enrichments before sales-ranked tail", async () => {
    // No sales at all for the pinned product, but it should still appear
    // first because the admin manually pinned it.
    tableData.line_items = {
      data: [
        { name: "Old Brownie Best Seller", catalog_object_id: null, quantity: "100" },
      ],
      error: null,
    };
    tableData.product_images = {
      data: [
        { slug: "brownieHearts", square_product_id: null, url: "https://fake/brownie.jpg", alt: null, kind: "product", sort_order: 0 },
        { slug: "blueberryMuffin", square_product_id: null, url: "https://fake/blueberry.jpg", alt: null, kind: "product", sort_order: 1 },
      ],
      error: null,
    };
    tableData.enrichments = {
      data: [
        { square_catalog_id: "PROD_BLUEBERRY", product_name: "Blueberry Protein Muffin" },
      ],
      error: null,
    };
    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    expect(body.items[0].name).toBe("Blueberry Protein Muffin"); // pinned first
    expect(body.items[0].image_url).toBe("https://fake/blueberry.jpg");
    expect(body.items[1].name).toBe("Old Brownie Best Seller"); // sales tail
  });

  it("dedupes when a pinned product is also a real bestseller", async () => {
    // Same product appears both as a sales line item AND as a pin —
    // should show ONCE at the top (pinned version), not twice.
    tableData.line_items = {
      data: [
        { name: "Blueberry Protein Muffin", catalog_object_id: null, quantity: "50" },
        { name: "Other Brownie Item", catalog_object_id: null, quantity: "10" },
      ],
      error: null,
    };
    tableData.product_images = {
      data: [
        { slug: "blueberryMuffin", square_product_id: null, url: "https://fake/blueberry.jpg", alt: null, kind: "product", sort_order: 0 },
        { slug: "brownieHearts", square_product_id: null, url: "https://fake/brownie.jpg", alt: null, kind: "product", sort_order: 1 },
      ],
      error: null,
    };
    tableData.enrichments = {
      data: [
        { square_catalog_id: "PROD_BLUEBERRY", product_name: "Blueberry Protein Muffin" },
      ],
      error: null,
    };
    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    const blueberryCount = body.items.filter((i: { name: string }) => i.name === "Blueberry Protein Muffin").length;
    expect(blueberryCount).toBe(1);
    expect(body.items[0].name).toBe("Blueberry Protein Muffin"); // still first via pin
  });

  it("drops pinned items that can't resolve to an image", async () => {
    // No matching product_images rows means no photo, which means no
    // card — same gradient-placeholder protection as the sales tail.
    tableData.line_items = {
      data: [{ name: "Brownie Real", catalog_object_id: null, quantity: "5" }],
      error: null,
    };
    tableData.product_images = {
      data: [{ slug: "brownieHearts", square_product_id: null, url: "https://fake/b.jpg", alt: null, kind: "product", sort_order: 0 }],
      error: null,
    };
    tableData.enrichments = {
      data: [
        { square_catalog_id: "PROD_NONEXISTENT", product_name: "Imaginary Product With No Image" },
      ],
      error: null,
    };
    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Brownie Real");
  });
});
