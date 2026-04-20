import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

/* eslint-disable @typescript-eslint/no-explicit-any */

const fixtures = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileMaybeSingle: vi.fn(),
  ordersByCustomerId: vi.fn(),
  ordersByEmail: vi.fn(),
  fulfillmentIn: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, key: string) => ({
    auth: { getUser: fixtures.getUser },
    from: (table: string) => {
      if (table === "customer_profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: fixtures.profileMaybeSingle }),
          }),
        };
      }
      if (table === "square_orders") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => fixtures.ordersByCustomerId() }),
            }),
            or: () => ({
              order: () => ({ limit: () => fixtures.ordersByEmail() }),
            }),
          }),
        };
      }
      if (table === "order_fulfillment") {
        return {
          select: () => ({ in: () => fixtures.fulfillmentIn() }),
        };
      }
      // Unhandled — the route shouldn't touch other tables in test paths.
      void key;
      throw new Error(`unmocked table: ${table}`);
    },
  }),
}));

import { GET } from "./route";

function req(headers: Record<string, string> = {}, cookie?: string): NextRequest {
  const h = new Headers(headers);
  if (cookie) h.set("cookie", cookie);
  return new NextRequest("http://localhost/api/account/orders", { headers: h });
}

function reset() {
  fixtures.getUser.mockReset();
  fixtures.profileMaybeSingle.mockReset();
  fixtures.ordersByCustomerId.mockReset();
  fixtures.ordersByEmail.mockReset();
  fixtures.fulfillmentIn.mockReset();

  fixtures.ordersByCustomerId.mockResolvedValue({ data: [], error: null });
  fixtures.ordersByEmail.mockResolvedValue({ data: [], error: null });
  fixtures.fulfillmentIn.mockResolvedValue({ data: [], error: null });
}

describe("app/api/account/orders GET", () => {
  beforeEach(() => reset());

  it("401 when no Authorization header + no cookie", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("401 when Supabase rejects the JWT", async () => {
    fixtures.getUser.mockResolvedValue({ data: { user: null }, error: new Error("bad token") });
    const res = await GET(req({ authorization: "Bearer bad" }));
    expect(res.status).toBe(401);
  });

  it("returns empty list when no orders match", async () => {
    fixtures.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "new@example.com" } },
      error: null,
    });
    fixtures.profileMaybeSingle.mockResolvedValue({ data: { square_customer_id: null, email: "new@example.com" }, error: null });

    const res = await GET(req({ authorization: "Bearer tok" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toEqual([]);
  });

  it("merges orders found via customer_id AND via email fallback, dedupes by id", async () => {
    fixtures.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "repeat@example.com" } },
      error: null,
    });
    fixtures.profileMaybeSingle.mockResolvedValue({
      data: { square_customer_id: "SQCUST_1", email: "repeat@example.com" },
      error: null,
    });
    // Same order ID appears in both result sets — should dedupe to one row
    fixtures.ordersByCustomerId.mockResolvedValue({
      data: [
        {
          id: "ORD_A",
          created_at: "2026-04-19T10:00:00Z",
          state: "COMPLETED",
          total_money_cents: 3899,
          source_name: "Square Point of Sale",
          customer_id: "SQCUST_1",
          raw: {},
          line_items: [{ id: "LI_1", name: "Brownie", quantity: "2", base_price_cents: 1950 }],
        },
      ],
      error: null,
    });
    fixtures.ordersByEmail.mockResolvedValue({
      data: [
        {
          id: "ORD_A", // duplicate — expect dedupe
          created_at: "2026-04-19T10:00:00Z",
          state: "COMPLETED",
          total_money_cents: 3899,
          source_name: "Square Point of Sale",
          customer_id: "SQCUST_1",
          raw: {},
          line_items: [],
        },
        {
          id: "ORD_B",
          created_at: "2026-04-18T10:00:00Z",
          state: "COMPLETED",
          total_money_cents: 2500,
          source_name: "External API",
          customer_id: null,
          raw: { fulfillments: [{ pickupDetails: { recipient: { emailAddress: "repeat@example.com" } } }] },
          line_items: [],
        },
      ],
      error: null,
    });

    const res = await GET(req({ authorization: "Bearer tok" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(2);
    expect(body.orders.map((o: { id: string }) => o.id)).toEqual(["ORD_A", "ORD_B"]);
    expect(body.orders[0].shortId).toBe("ORD_A".slice(-6).toUpperCase());
  });

  it("attaches fulfillment overlay to each order by id", async () => {
    fixtures.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "c@example.com" } },
      error: null,
    });
    fixtures.profileMaybeSingle.mockResolvedValue({
      data: { square_customer_id: "SQCUST_1", email: "c@example.com" },
      error: null,
    });
    fixtures.ordersByCustomerId.mockResolvedValue({
      data: [
        { id: "ORD_SHIP", created_at: "2026-04-19T10:00:00Z", state: "COMPLETED", total_money_cents: 5000, source_name: null, raw: {}, line_items: [] },
      ],
      error: null,
    });
    fixtures.fulfillmentIn.mockResolvedValue({
      data: [{ square_order_id: "ORD_SHIP", status: "shipped", tracking_number: "1Z9", carrier: "UPS", shipped_at: "2026-04-19T12:00:00Z" }],
      error: null,
    });

    const res = await GET(req({ authorization: "Bearer tok" }));
    const body = await res.json();
    expect(body.orders[0].fulfillment).toMatchObject({ status: "shipped", tracking_number: "1Z9", carrier: "UPS" });
  });

  it("falls back to sb-access-token cookie when Authorization header missing", async () => {
    fixtures.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "cookie@example.com" } },
      error: null,
    });
    fixtures.profileMaybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await GET(req({}, "sb-access-token=tok"));
    expect(res.status).toBe(200);
  });

  it("sorts orders by created_at desc", async () => {
    fixtures.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "c@example.com" } },
      error: null,
    });
    fixtures.profileMaybeSingle.mockResolvedValue({
      data: { square_customer_id: "SQCUST_1", email: "c@example.com" },
      error: null,
    });
    fixtures.ordersByCustomerId.mockResolvedValue({
      data: [
        { id: "OLDER", created_at: "2026-01-01T00:00:00Z", state: "COMPLETED", total_money_cents: 0, source_name: null, raw: {}, line_items: [] },
        { id: "NEWER", created_at: "2026-04-20T00:00:00Z", state: "COMPLETED", total_money_cents: 0, source_name: null, raw: {}, line_items: [] },
      ],
      error: null,
    });
    const res = await GET(req({ authorization: "Bearer tok" }));
    const body = await res.json();
    expect(body.orders[0].id).toBe("NEWER");
    expect(body.orders[1].id).toBe("OLDER");
  });
});
