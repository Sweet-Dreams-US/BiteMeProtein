import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/square", () => ({
  getSquareClient: () => ({
    orders: { search: vi.fn().mockResolvedValue({ orders: [] }), get: vi.fn() },
    payments: { get: vi.fn() },
  }),
  getLocationId: () => "TESTLOCATION",
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

import { GET } from "./route";

function req(url: string): NextRequest {
  return new NextRequest(url);
}

describe("app/api/orders/track GET — 2-factor gate", () => {
  it("returns 400 when id is missing", async () => {
    const res = await GET(req("http://localhost/api/orders/track?email=a@b.com"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/order id and email/i);
  });

  it("returns 400 when email is missing", async () => {
    const res = await GET(req("http://localhost/api/orders/track?id=abc123"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/order id and email/i);
  });

  it("returns 400 when both are missing", async () => {
    const res = await GET(req("http://localhost/api/orders/track"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when short-id search finds no matching order", async () => {
    // Short IDs go through the search path, which is mocked above to return empty.
    const res = await GET(req("http://localhost/api/orders/track?id=ABC123&email=a@b.com"));
    expect(res.status).toBe(404);
  });
});
