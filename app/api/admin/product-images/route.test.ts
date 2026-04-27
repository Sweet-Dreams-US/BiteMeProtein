import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

const mocks = vi.hoisted(() => {
  const single = vi.fn();
  const deleteEq = vi.fn();
  const updateEq = vi.fn();
  // square_products parent-row upsert. Default success; tests override
  // mockResolvedValueOnce when they want to simulate FK / RLS failures.
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const getUser = vi.fn();
  return { single, deleteEq, updateEq, upsert, getUser };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === "admin_users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { email: "haley@bitemeprotein.com" }, error: null }),
            }),
          }),
        };
      }
      if (table === "square_products") {
        // Route awaits .upsert(...) directly, no chained .select() — keep it
        // a thenable function so the same vi.fn() is both spy and impl.
        return { upsert: mocks.upsert };
      }
      // product_images
      return {
        insert: () => ({ select: () => ({ single: mocks.single }) }),
        delete: () => ({ eq: mocks.deleteEq }),
        update: () => ({ eq: mocks.updateEq }),
      };
    },
  }),
}));

import { POST, PATCH, DELETE } from "./route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function req(url: string, init: any = {}): NextRequest {
  return new NextRequest(url, init);
}

describe("app/api/admin/product-images", () => {
  beforeEach(() => {
    mocks.single.mockReset();
    mocks.deleteEq.mockReset();
    mocks.updateEq.mockReset();
    mocks.upsert.mockReset();
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.getUser.mockReset();
  });

  describe("POST", () => {
    it("401 when unauthenticated", async () => {
      const res = await POST(req("http://localhost/api/admin/product-images", { method: "POST", body: "{}" }));
      expect(res.status).toBe(401);
    });

    it("400 when url is missing", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
      const res = await POST(req("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ slug: "brownie" }),
      }));
      expect(res.status).toBe(400);
    });

    it("400 when neither squareProductId nor slug provided", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
      const res = await POST(req("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ url: "https://example.com/x.jpg" }),
      }));
      expect(res.status).toBe(400);
    });

    it("400 when kind is invalid", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
      const res = await POST(req("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ url: "x", slug: "s", kind: "not-a-kind" }),
      }));
      expect(res.status).toBe(400);
    });

    it("inserts when authenticated with valid body (slug-only path)", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
      mocks.single.mockResolvedValue({ data: { id: "new-uuid" }, error: null });
      const res = await POST(req("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ slug: "brownie", url: "https://x.com/b.jpg", kind: "product" }),
      }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.image.id).toBe("new-uuid");
      // Slug-only uploads must NEVER touch square_products — those rows
      // belong to the catalog sync, and writing a stub with no real ID
      // would corrupt the sync's idempotency.
      expect(mocks.upsert).not.toHaveBeenCalled();
    });

    it("upserts square_products stub before insert when squareProductId provided", async () => {
      // The whole reason this route now does an upsert: the FK
      // product_images.square_product_id -> square_products(id) was
      // erroring on uploads because the catalog sync wasn't populating
      // the parent table. Lazy upsert keeps uploads working without
      // depending on that sync.
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
      mocks.single.mockResolvedValue({ data: { id: "new-uuid" }, error: null });
      const res = await POST(req("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({
          squareProductId: "SQUARE_CATALOG_123",
          productName: "Protein Brownies",
          url: "https://x.com/b.jpg",
        }),
      }));
      expect(res.status).toBe(200);
      expect(mocks.upsert).toHaveBeenCalledTimes(1);
      const [row, opts] = mocks.upsert.mock.calls[0];
      expect(row).toEqual({ id: "SQUARE_CATALOG_123", name: "Protein Brownies", raw: {} });
      // Idempotency knob — re-uploading must not overwrite a real
      // catalog-synced row's `raw` payload with our empty stub.
      expect(opts).toEqual({ onConflict: "id", ignoreDuplicates: true });
    });

    it("returns 500 when the parent square_products upsert fails", async () => {
      // If RLS or some other issue blocks the parent upsert, surface
      // it explicitly rather than letting the FK violation produce a
      // confusing error message downstream.
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
      mocks.upsert.mockResolvedValueOnce({ error: { message: "permission denied" } });
      const res = await POST(req("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ squareProductId: "X", url: "https://x.com/b.jpg" }),
      }));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain("permission denied");
      // Image insert should NOT have been attempted if the parent failed.
      expect(mocks.single).not.toHaveBeenCalled();
    });
  });

  describe("PATCH — reorder", () => {
    it("401 when unauthenticated", async () => {
      const res = await PATCH(req("http://localhost/api/admin/product-images", { method: "PATCH", body: "{}" }));
      expect(res.status).toBe(401);
    });

    it("400 when updates[] missing", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
      const res = await PATCH(req("http://localhost/api/admin/product-images", {
        method: "PATCH",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({}),
      }));
      expect(res.status).toBe(400);
    });

    it("updates all rows in the batch", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
      mocks.updateEq.mockResolvedValue({ error: null });
      const res = await PATCH(req("http://localhost/api/admin/product-images", {
        method: "PATCH",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ updates: [{ id: "a", sort_order: 0 }, { id: "b", sort_order: 1 }] }),
      }));
      expect(res.status).toBe(200);
      expect(mocks.updateEq).toHaveBeenCalledTimes(2);
    });
  });

  describe("DELETE", () => {
    it("401 when unauthenticated", async () => {
      const res = await DELETE(req("http://localhost/api/admin/product-images?id=1", { method: "DELETE" }));
      expect(res.status).toBe(401);
    });

    it("400 when id missing", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
      const res = await DELETE(req("http://localhost/api/admin/product-images", {
        method: "DELETE",
        headers: { authorization: "Bearer tok" },
      }));
      expect(res.status).toBe(400);
    });

    it("deletes when authenticated", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
      mocks.deleteEq.mockResolvedValue({ error: null });
      const res = await DELETE(req("http://localhost/api/admin/product-images?id=abc", {
        method: "DELETE",
        headers: { authorization: "Bearer tok" },
      }));
      expect(res.status).toBe(200);
    });
  });
});
