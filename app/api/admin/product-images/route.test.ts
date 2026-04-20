import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

const mocks = vi.hoisted(() => {
  const single = vi.fn();
  const deleteEq = vi.fn();
  const updateEq = vi.fn();
  const getUser = vi.fn();
  return { single, deleteEq, updateEq, getUser };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      insert: () => ({ select: () => ({ single: mocks.single }) }),
      delete: () => ({ eq: mocks.deleteEq }),
      update: () => ({ eq: mocks.updateEq }),
    }),
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
    mocks.getUser.mockReset();
  });

  describe("POST", () => {
    it("401 when unauthenticated", async () => {
      const res = await POST(req("http://localhost/api/admin/product-images", { method: "POST", body: "{}" }));
      expect(res.status).toBe(401);
    });

    it("400 when url is missing", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      const res = await POST(req("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ slug: "brownie" }),
      }));
      expect(res.status).toBe(400);
    });

    it("400 when neither squareProductId nor slug provided", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      const res = await POST(req("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ url: "https://example.com/x.jpg" }),
      }));
      expect(res.status).toBe(400);
    });

    it("400 when kind is invalid", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      const res = await POST(req("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ url: "x", slug: "s", kind: "not-a-kind" }),
      }));
      expect(res.status).toBe(400);
    });

    it("inserts when authenticated with valid body", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      mocks.single.mockResolvedValue({ data: { id: "new-uuid" }, error: null });
      const res = await POST(req("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ slug: "brownie", url: "https://x.com/b.jpg", kind: "product" }),
      }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.image.id).toBe("new-uuid");
    });
  });

  describe("PATCH — reorder", () => {
    it("401 when unauthenticated", async () => {
      const res = await PATCH(req("http://localhost/api/admin/product-images", { method: "PATCH", body: "{}" }));
      expect(res.status).toBe(401);
    });

    it("400 when updates[] missing", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      const res = await PATCH(req("http://localhost/api/admin/product-images", {
        method: "PATCH",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({}),
      }));
      expect(res.status).toBe(400);
    });

    it("updates all rows in the batch", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
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
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      const res = await DELETE(req("http://localhost/api/admin/product-images", {
        method: "DELETE",
        headers: { authorization: "Bearer tok" },
      }));
      expect(res.status).toBe(400);
    });

    it("deletes when authenticated", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      mocks.deleteEq.mockResolvedValue({ error: null });
      const res = await DELETE(req("http://localhost/api/admin/product-images?id=abc", {
        method: "DELETE",
        headers: { authorization: "Bearer tok" },
      }));
      expect(res.status).toBe(200);
    });
  });
});
