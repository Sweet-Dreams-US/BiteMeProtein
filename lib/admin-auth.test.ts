import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockAdminLookup = vi.fn();

// We need to simulate TWO createClient calls inside requireAdmin:
// 1. auth client (anon key) — has .auth.getUser(...)
// 2. service client (service role key) — has .from("admin_users").select(...).eq(...).maybeSingle()
// The mock returns different shapes based on which positional arg matches
// the service key. In tests we just alternate on call count.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => {
    // First call = auth client, second call = service client.
    // Vitest resets call count in beforeEach below.
    const callIndex = (globalThis as unknown as { __cc: number }).__cc++;
    if (callIndex === 0) {
      return { auth: { getUser: mockGetUser } };
    }
    return {
      from: (_table: string) => ({
        select: (_cols: string) => ({
          eq: (_col: string, _val: string) => ({
            maybeSingle: () => mockAdminLookup(),
          }),
        }),
      }),
    };
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
    mockAdminLookup.mockReset();
    (globalThis as unknown as { __cc: number }).__cc = 0;
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

  it("returns 401 when user has no email (orphaned auth row)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: null } }, error: null });
    const res = await requireAdmin(buildRequest({ authorization: "Bearer token" }));
    expect(res?.status).toBe(401);
  });

  it("returns 403 when user is authenticated but NOT in admin_users", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "random@example.com" } }, error: null });
    mockAdminLookup.mockResolvedValue({ data: null });
    const res = await requireAdmin(buildRequest({ authorization: "Bearer token" }));
    expect(res?.status).toBe(403);
  });

  it("returns null (allowed) when user is authenticated AND in admin_users", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
    mockAdminLookup.mockResolvedValue({ data: { email: "haley@bitemeprotein.com" } });
    const res = await requireAdmin(buildRequest({ authorization: "Bearer goodtoken" }));
    expect(res).toBeNull();
    expect(mockGetUser).toHaveBeenCalledWith("goodtoken");
  });

  it("lowercases email before admin lookup (case-insensitive match)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "HALEY@Bitemeprotein.com" } }, error: null });
    mockAdminLookup.mockResolvedValue({ data: { email: "haley@bitemeprotein.com" } });
    const res = await requireAdmin(buildRequest({ authorization: "Bearer token" }));
    expect(res).toBeNull();
  });
});
