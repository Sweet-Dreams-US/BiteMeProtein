import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

import { requireAdmin } from "./admin-auth";

function buildRequest(headers: Record<string, string> = {}, cookie?: string): NextRequest {
  const h = new Headers(headers);
  if (cookie) h.set("cookie", cookie);
  return new NextRequest("http://localhost/api/admin/test", { headers: h });
}

describe("lib/admin-auth", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  it("returns 401 when no token and no cookie present", async () => {
    const res = await requireAdmin(buildRequest());
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("returns 401 when Supabase rejects the token", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("bad token") });
    const res = await requireAdmin(buildRequest({ authorization: "Bearer badtoken" }));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("returns null (allowed) when Bearer token validates", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
    const res = await requireAdmin(buildRequest({ authorization: "Bearer goodtoken" }));
    expect(res).toBeNull();
    expect(mockGetUser).toHaveBeenCalledWith("goodtoken");
  });

  it("accepts a sb-access-token cookie as fallback", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = await requireAdmin(buildRequest({}, "sb-access-token=cookie-value"));
    // When no Authorization header is present, the code passes `undefined` to
    // getUser — Supabase then reads the access token from cookies itself.
    expect(res).toBeNull();
  });
});
