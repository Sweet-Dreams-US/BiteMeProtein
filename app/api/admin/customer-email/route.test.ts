import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  orderMaybeSingle: vi.fn(),
  fulfillmentMaybeSingle: vi.fn(),
  sendCustomerEmail: vi.fn().mockResolvedValue(undefined),
}));

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
      return {
        select: () => ({
          eq: () => ({
            maybeSingle:
              table === "square_orders" ? mocks.orderMaybeSingle : mocks.fulfillmentMaybeSingle,
          }),
        }),
      };
    },
  }),
}));

vi.mock("@/lib/customer-emails", () => ({
  sendCustomerEmail: mocks.sendCustomerEmail,
  carrierTrackingUrl: (c: string | null, t: string | null) =>
    c && t ? `https://fake/tracking/${c}/${t}` : null,
}));

import { POST } from "./route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function req(url: string, init: any = {}): NextRequest {
  return new NextRequest(url, init);
}

describe("app/api/admin/customer-email POST", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.orderMaybeSingle.mockReset();
    mocks.fulfillmentMaybeSingle.mockReset();
    mocks.sendCustomerEmail.mockReset();
    mocks.sendCustomerEmail.mockResolvedValue(undefined);
  });

  it("401 when unauthenticated", async () => {
    const res = await POST(req("http://localhost/api/admin/customer-email", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("400 when orderId missing", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
    const res = await POST(req("http://localhost/api/admin/customer-email", {
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: JSON.stringify({ type: "confirmation" }),
    }));
    expect(res.status).toBe(400);
  });

  it("400 when type is invalid", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
    const res = await POST(req("http://localhost/api/admin/customer-email", {
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: JSON.stringify({ orderId: "O1", type: "bogus" }),
    }));
    expect(res.status).toBe(400);
  });

  it("404 when order not found", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
    mocks.orderMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.fulfillmentMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(req("http://localhost/api/admin/customer-email", {
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: JSON.stringify({ orderId: "O_missing", type: "confirmation" }),
    }));
    expect(res.status).toBe(404);
  });

  it("200 sent:false when order has no customer email anywhere", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
    mocks.orderMaybeSingle.mockResolvedValue({
      data: {
        id: "O_1",
        total_money_cents: 3899,
        line_items: [],
        customer: null,
        raw: { fulfillments: [{ type: "SHIPMENT", shipmentDetails: { recipient: {} } }] },
      },
      error: null,
    });
    mocks.fulfillmentMaybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await POST(req("http://localhost/api/admin/customer-email", {
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: JSON.stringify({ orderId: "O_1", type: "confirmation" }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(false);
    expect(mocks.sendCustomerEmail).not.toHaveBeenCalled();
  });

  it("200 sent:true and dispatches with the right data shape", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
    mocks.orderMaybeSingle.mockResolvedValue({
      data: {
        id: "SQUARE_ORD_ABCDEF",
        total_money_cents: 3899,
        line_items: [{ name: "Brownie", quantity: 6, base_price_cents: 3899 }],
        customer: { email: "customer@example.com", given_name: "Jamie", family_name: "Smith" },
        raw: { fulfillments: [{ type: "SHIPMENT" }] },
      },
      error: null,
    });
    mocks.fulfillmentMaybeSingle.mockResolvedValue({
      data: { tracking_number: "999", carrier: "FedEx" },
      error: null,
    });

    const res = await POST(req("http://localhost/api/admin/customer-email", {
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: JSON.stringify({ orderId: "SQUARE_ORD_ABCDEF", type: "shipped" }),
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(true);
    expect(mocks.sendCustomerEmail).toHaveBeenCalledWith(
      "shipped",
      expect.objectContaining({
        orderId: "SQUARE_ORD_ABCDEF",
        shortId: "ABCDEF",
        buyerEmail: "customer@example.com",
        buyerName: "Jamie Smith",
        totalCents: 3899,
        orderType: "shipping",
        carrier: "FedEx",
        trackingNumber: "999",
      }),
    );
  });

  it("falls back to raw fulfillment recipient when customer row is missing", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "haley@bitemeprotein.com" } }, error: null });
    mocks.orderMaybeSingle.mockResolvedValue({
      data: {
        id: "O_pickup",
        total_money_cents: 1999,
        line_items: [],
        customer: null,
        raw: {
          fulfillments: [
            {
              type: "PICKUP",
              pickupDetails: { recipient: { emailAddress: "pickup@example.com", displayName: "Walk-In" } },
            },
          ],
        },
      },
      error: null,
    });
    mocks.fulfillmentMaybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await POST(req("http://localhost/api/admin/customer-email", {
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: JSON.stringify({ orderId: "O_pickup", type: "preparing" }),
    }));
    expect(res.status).toBe(200);
    expect(mocks.sendCustomerEmail).toHaveBeenCalledWith(
      "preparing",
      expect.objectContaining({
        buyerEmail: "pickup@example.com",
        orderType: "pickup",
      }),
    );
  });
});
