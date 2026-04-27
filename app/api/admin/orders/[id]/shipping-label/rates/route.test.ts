import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  orderMaybeSingle: vi.fn(),
  upsert: vi.fn().mockResolvedValue({ error: null }),
  createShipment: vi.fn(),
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
      if (table === "square_orders") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mocks.orderMaybeSingle,
            }),
          }),
        };
      }
      if (table === "order_fulfillment") {
        return { upsert: mocks.upsert };
      }
      throw new Error(`unmocked table ${table}`);
    },
  }),
}));

vi.mock("@/lib/easypost", () => ({
  createShipment: mocks.createShipment,
  priceCents: (r: { rate: string }) => Math.round(parseFloat(r.rate) * 100),
}));

import { POST } from "./route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function req(url: string, init: any = {}): NextRequest {
  return new NextRequest(url, init);
}

const orderUrl = "http://localhost/api/admin/orders/ORD_1/shipping-label/rates";
const validBody = JSON.stringify({ weightOz: 16, lengthIn: 8, widthIn: 6, heightIn: 4 });

const SHIPMENT_ORDER_RAW = {
  fulfillments: [
    {
      type: "SHIPMENT",
      shipmentDetails: {
        recipient: {
          displayName: "Jane Buyer",
          phoneNumber: "555-0101",
          emailAddress: "jane@x.com",
          address: {
            addressLine1: "100 Pine St",
            locality: "Brooklyn",
            administrativeDistrictLevel1: "NY",
            postalCode: "11201",
            country: "US",
            firstName: "Jane",
            lastName: "Buyer",
          },
        },
      },
    },
  ],
};

describe("app/api/admin/orders/[id]/shipping-label/rates POST", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.orderMaybeSingle.mockReset();
    mocks.upsert.mockReset();
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.createShipment.mockReset();
  });

  function authedParams() {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "haley@bitemeprotein.com" } },
      error: null,
    });
    return { params: Promise.resolve({ id: "ORD_1" }) };
  }

  it("401 when unauthenticated", async () => {
    const res = await POST(
      req(orderUrl, { method: "POST", body: validBody }),
      { params: Promise.resolve({ id: "ORD_1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("400 when parcel inputs missing or zero", async () => {
    const res = await POST(
      req(orderUrl, {
        method: "POST",
        headers: { authorization: "Bearer t" },
        body: JSON.stringify({ weightOz: 0, lengthIn: 8, widthIn: 6, heightIn: 4 }),
      }),
      authedParams(),
    );
    expect(res.status).toBe(400);
    expect(mocks.createShipment).not.toHaveBeenCalled();
  });

  it("404 when the order doesn't exist", async () => {
    mocks.orderMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(
      req(orderUrl, { method: "POST", headers: { authorization: "Bearer t" }, body: validBody }),
      authedParams(),
    );
    expect(res.status).toBe(404);
  });

  it("400 when the order has no shipping fulfillment (pickup-only)", async () => {
    mocks.orderMaybeSingle.mockResolvedValue({
      data: {
        id: "ORD_1",
        raw: { fulfillments: [{ type: "PICKUP", pickupDetails: {} }] },
      },
      error: null,
    });
    const res = await POST(
      req(orderUrl, { method: "POST", headers: { authorization: "Bearer t" }, body: validBody }),
      authedParams(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no shipping fulfillment/i);
  });

  it("400 when recipient address is missing required fields", async () => {
    mocks.orderMaybeSingle.mockResolvedValue({
      data: {
        id: "ORD_1",
        raw: {
          fulfillments: [
            {
              type: "SHIPMENT",
              shipmentDetails: { recipient: { address: { addressLine1: "" } } },
            },
          ],
        },
      },
      error: null,
    });
    const res = await POST(
      req(orderUrl, { method: "POST", headers: { authorization: "Bearer t" }, body: validBody }),
      authedParams(),
    );
    expect(res.status).toBe(400);
    expect(mocks.createShipment).not.toHaveBeenCalled();
  });

  it("calls EasyPost createShipment with mapped recipient + parcel + order ID as reference", async () => {
    mocks.orderMaybeSingle.mockResolvedValue({
      data: { id: "ORD_1", raw: SHIPMENT_ORDER_RAW },
      error: null,
    });
    mocks.createShipment.mockResolvedValue({
      id: "shp_abc",
      rates: [
        { id: "r1", carrier: "FedEx", service: "Ground", rate: "12.34", delivery_days: 3, delivery_date: null, delivery_date_guaranteed: false },
        { id: "r2", carrier: "USPS", service: "Priority", rate: "9.50", delivery_days: 2, delivery_date: null, delivery_date_guaranteed: false },
      ],
    });

    const res = await POST(
      req(orderUrl, { method: "POST", headers: { authorization: "Bearer t" }, body: validBody }),
      authedParams(),
    );

    expect(res.status).toBe(200);
    expect(mocks.createShipment).toHaveBeenCalledTimes(1);
    const call = mocks.createShipment.mock.calls[0][0];
    // Recipient mapped from Square shipmentDetails
    expect(call.to).toMatchObject({
      name: "Jane Buyer",
      street1: "100 Pine St",
      city: "Brooklyn",
      state: "NY",
      zip: "11201",
      country: "US",
      email: "jane@x.com",
    });
    expect(call.parcel).toEqual({ length: 8, width: 6, height: 4, weight: 16 });
    // Reference is the Square order ID — shows up in EasyPost dashboard
    // so Haley can debug labels by their real order ID, not random EP IDs.
    expect(call.reference).toBe("ORD_1");

    // Shipment ID stored on order_fulfillment so /buy can find it later
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({
      square_order_id: "ORD_1",
      easypost_shipment_id: "shp_abc",
    });

    const body = await res.json();
    expect(body.shipmentId).toBe("shp_abc");
    expect(body.rates).toHaveLength(2);
    expect(body.rates[0]).toMatchObject({
      id: "r1",
      carrier: "FedEx",
      service: "Ground",
      priceCents: 1234,
    });
  });

  it("returns 500 with the EasyPost error message when createShipment throws", async () => {
    mocks.orderMaybeSingle.mockResolvedValue({
      data: { id: "ORD_1", raw: SHIPMENT_ORDER_RAW },
      error: null,
    });
    mocks.createShipment.mockRejectedValue(new Error("EasyPost 422: address invalid"));
    const res = await POST(
      req(orderUrl, { method: "POST", headers: { authorization: "Bearer t" }, body: validBody }),
      authedParams(),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("address invalid");
  });
});
