import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

const mocks = vi.hoisted(() => {
  const upsert = vi.fn();
  const del = vi.fn();
  const deleteEq = vi.fn();
  const order = vi.fn();
  const getUser = vi.fn();
  return { upsert, del, deleteEq, order, getUser };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({ order: mocks.order }),
      upsert: mocks.upsert,
      delete: () => ({ eq: mocks.deleteEq }),
    }),
  }),
}));

import { GET, PUT, DELETE } from "./route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function req(url: string, init: any = {}): NextRequest {
  return new NextRequest(url, init);
}

describe("app/api/admin/content", () => {
  beforeEach(() => {
    mocks.upsert.mockReset();
    mocks.del.mockReset();
    mocks.deleteEq.mockReset();
    mocks.order.mockReset();
    mocks.getUser.mockReset();
  });

  describe("GET", () => {
    it("401 when unauthenticated", async () => {
      const res = await GET(req("http://localhost/api/admin/content"));
      expect(res.status).toBe(401);
    });

    it("returns rows when authenticated", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      mocks.order.mockResolvedValue({
        data: [{ key: "hero.title", value: "Welcome", updated_at: new Date().toISOString() }],
        error: null,
      });
      const res = await GET(req("http://localhost/api/admin/content", { headers: { authorization: "Bearer tok" } }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.rows).toHaveLength(1);
    });
  });

  describe("PUT", () => {
    it("401 when unauthenticated", async () => {
      const res = await PUT(req("http://localhost/api/admin/content", { method: "PUT", body: JSON.stringify({ key: "x", value: "y" }) }));
      expect(res.status).toBe(401);
    });

    it("400 when key is missing", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      const res = await PUT(req("http://localhost/api/admin/content", {
        method: "PUT",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ value: "y" }),
      }));
      expect(res.status).toBe(400);
    });

    it("400 when value is missing", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      const res = await PUT(req("http://localhost/api/admin/content", {
        method: "PUT",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ key: "hero.title" }),
      }));
      expect(res.status).toBe(400);
    });

    it("upserts when authenticated with valid body", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      mocks.upsert.mockResolvedValue({ error: null });
      const res = await PUT(req("http://localhost/api/admin/content", {
        method: "PUT",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ key: "hero.title", value: "Hi" }),
      }));
      expect(res.status).toBe(200);
      expect(mocks.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ key: "hero.title", value: "Hi" }),
        { onConflict: "key" },
      );
    });

    it("accepts null / false / 0 as values (uses explicit undefined check)", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      mocks.upsert.mockResolvedValue({ error: null });
      const res = await PUT(req("http://localhost/api/admin/content", {
        method: "PUT",
        headers: { authorization: "Bearer tok" },
        body: JSON.stringify({ key: "some.flag", value: null }),
      }));
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE", () => {
    it("401 when unauthenticated", async () => {
      const res = await DELETE(req("http://localhost/api/admin/content?key=hero.title", { method: "DELETE" }));
      expect(res.status).toBe(401);
    });

    it("400 when key missing", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      const res = await DELETE(req("http://localhost/api/admin/content", { method: "DELETE", headers: { authorization: "Bearer tok" } }));
      expect(res.status).toBe(400);
    });

    it("deletes when authenticated", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      mocks.deleteEq.mockResolvedValue({ error: null });
      const res = await DELETE(req("http://localhost/api/admin/content?key=hero.title", {
        method: "DELETE",
        headers: { authorization: "Bearer tok" },
      }));
      expect(res.status).toBe(200);
    });
  });
});
