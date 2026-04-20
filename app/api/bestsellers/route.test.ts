import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

/* eslint-disable @typescript-eslint/no-explicit-any */

// Per-table fixture + builder. The route issues three parallel queries
// against square_order_line_items, square_product_variations, and
// product_images — each with different chain shapes.
const tableData = vi.hoisted(() => ({
  line_items: { data: [] as any[] | null, error: null as any },
  variations: { data: [] as any[] | null, error: null as any },
  product_images: { data: [] as any[] | null, error: null as any },
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

  it("returns null image_url when neither product_id nor slug matches", async () => {
    tableData.line_items = {
      data: [{ name: "Totally Unique Product", catalog_object_id: null, quantity: "1" }],
      error: null,
    };
    tableData.product_images = {
      data: [{ slug: "brownieHearts", square_product_id: null, url: "https://fake/brownie.jpg", alt: null, kind: "product", sort_order: 0 }],
      error: null,
    };

    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    expect(body.items[0].image_url).toBeNull();
  });

  it("respects ?limit and clamps to [1, 50]", async () => {
    tableData.line_items = {
      data: [
        { name: "A", catalog_object_id: null, quantity: "5" },
        { name: "B", catalog_object_id: null, quantity: "3" },
        { name: "C", catalog_object_id: null, quantity: "1" },
      ],
      error: null,
    };
    const res = await GET(req("http://localhost/api/bestsellers?limit=2"));
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].name).toBe("A");
    expect(body.items[1].name).toBe("B");
  });

  it("treats non-numeric quantity as 0", async () => {
    tableData.line_items = {
      data: [
        { name: "Weird Item", catalog_object_id: null, quantity: "not-a-number" },
        { name: "Weird Item", catalog_object_id: null, quantity: null },
        { name: "Real Item", catalog_object_id: null, quantity: "3" },
      ],
      error: null,
    };
    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    expect(body.items[0]).toMatchObject({ name: "Real Item", total_sold: 3 });
    expect(body.items[1]).toMatchObject({ name: "Weird Item", total_sold: 0 });
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
        { name: "Real", catalog_object_id: null, quantity: "1" },
      ],
      error: null,
    };
    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    expect(body.items).toEqual([
      expect.objectContaining({ name: "Real", total_sold: 1 }),
    ]);
  });
});
