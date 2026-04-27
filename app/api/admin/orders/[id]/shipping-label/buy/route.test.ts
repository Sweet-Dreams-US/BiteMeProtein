import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  fulfillmentMaybeSingle: vi.fn(),
  orderMaybeSingle: vi.fn(),
  upsert: vi.fn().mockResolvedValue({ error: null }),
  buyLabel: vi.fn(),
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
      if (table === "order_fulfillment") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mocks.fulfillmentMaybeSingle,
            }),
          }),
          upsert: mocks.upsert,
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
      throw new Error(`unmocked table ${table}`);
    },
  }),
}));

vi.mock("@/lib/easypost", () => ({
  buyLabel: mocks.buyLabel,
}));

vi.mock("@/lib/customer-emails", () => ({
  sendCustomerEmail: mocks.sendCustomerEmail,
}));

import { POST } from "./route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function req(url: string, init: any = {}): NextRequest {
  return new NextRequest(url, init);
}

const url = "http://localhost/api/admin/orders/ORD_1/shipping-label/buy";
const validBody = JSON.stringify({ rateId: "rate_99", shipmentId: "shp_abc" });

function authedParams() {
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "u1", email: "haley@bitemeprotein.com" } },
    error: null,
  });
  return { params: Promise.resolve({ id: "ORD_1" }) };
}

const SUCCESSFUL_BUY = {
  id: "shp_abc",
  tracking_code: "TRK999",
  status: "purchased",
  rates: [],
  selected_rate: { id: "rate_99", carrier: "FedEx", service: "Ground", rate: "12.34" },
  postage_label: { label_url: "https://easypost.com/labels/abc.pdf" },
  tracker: { public_url: "https://track.easypost.com/abc" },
  reference: "ORD_1",
};

describe("app/api/admin/orders/[id]/shipping-label/buy POST", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.fulfillmentMaybeSingle.mockReset();
    mocks.orderMaybeSingle.mockReset();
    mocks.upsert.mockReset();
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.buyLabel.mockReset();
    mocks.sendCustomerEmail.mockClear();
    // Default: no existing fulfillment row
    mocks.fulfillmentMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("401 when unauthenticated", async () => {
    const res = await POST(
      req(url, { method: "POST", body: validBody }),
      { params: Promise.resolve({ id: "ORD_1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("400 when rateId or shipmentId missing", async () => {
    const res = await POST(
      req(url, {
        method: "POST",
        headers: { authorization: "Bearer t" },
        body: JSON.stringify({ rateId: "rate_99" }),
      }),
      authedParams(),
    );
    expect(res.status).toBe(400);
    expect(mocks.buyLabel).not.toHaveBeenCalled();
  });

  it("409 when the order already has a tracking number — refuse to double-buy", async () => {
    // Idempotency guard: a label already bought means money already spent
    // and the customer already emailed. Don't auto-overwrite.
    mocks.fulfillmentMaybeSingle.mockResolvedValue({
      data: { tracking_number: "OLD_TRK", easypost_shipment_id: "shp_abc" },
      error: null,
    });
    const res = await POST(
      req(url, { method: "POST", headers: { authorization: "Bearer t" }, body: validBody }),
      authedParams(),
    );
    expect(res.status).toBe(409);
    expect(mocks.buyLabel).not.toHaveBeenCalled();
  });

  it("buys the label, persists tracking + label URL + cost + status=shipped", async () => {
    mocks.buyLabel.mockResolvedValue(SUCCESSFUL_BUY);
    // Customer fetch for the post-buy email
    mocks.orderMaybeSingle.mockResolvedValue({
      data: {
        id: "ORD_1",
        total_money_cents: 5000,
        raw: {
          fulfillments: [
            {
              type: "SHIPMENT",
              shipmentDetails: { recipient: { emailAddress: "jane@x.com", displayName: "Jane B" } },
            },
          ],
        },
        line_items: [{ name: "Brownies", quantity: 1, base_price_cents: 5000 }],
        customer: [{ email: "jane@x.com", given_name: "Jane", family_name: "Buyer" }],
      },
      error: null,
    });

    const res = await POST(
      req(url, { method: "POST", headers: { authorization: "Bearer t" }, body: validBody }),
      authedParams(),
    );

    expect(res.status).toBe(200);
    expect(mocks.buyLabel).toHaveBeenCalledWith("shp_abc", "rate_99");

    // Verify the fulfillment upsert payload — this is where everything
    // important about the bought label gets persisted.
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const saved = mocks.upsert.mock.calls[0][0];
    expect(saved).toMatchObject({
      square_order_id: "ORD_1",
      status: "shipped",
      tracking_number: "TRK999",
      carrier: "FedEx",
      // No `service` in request body, so we fall back to the EasyPost
      // selected_rate.service — which is "Ground" alone (carrier is
      // stored separately). Admin UI usually sends a combined string
      // like "FedEx Ground"; verified in the next test.
      service: "Ground",
      label_url: "https://easypost.com/labels/abc.pdf",
      easypost_shipment_id: "shp_abc",
      label_cost_cents: 1234,
    });
    expect(saved.shipped_at).toBeTruthy();

    const body = await res.json();
    expect(body.tracking).toBe("TRK999");
    expect(body.labelUrl).toBe("https://easypost.com/labels/abc.pdf");
    expect(body.trackerUrl).toBe("https://track.easypost.com/abc");
  });

  it("uses caller-provided `service` string when given (admin sets the human label)", async () => {
    mocks.buyLabel.mockResolvedValue(SUCCESSFUL_BUY);
    mocks.orderMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(
      req(url, {
        method: "POST",
        headers: { authorization: "Bearer t" },
        body: JSON.stringify({
          rateId: "rate_99",
          shipmentId: "shp_abc",
          service: "FedEx 2Day",
        }),
      }),
      authedParams(),
    );
    expect(res.status).toBe(200);
    expect(mocks.upsert.mock.calls[0][0].service).toBe("FedEx 2Day");
  });

  it("returns 502 when EasyPost replies without tracking_code or label", async () => {
    mocks.buyLabel.mockResolvedValue({
      ...SUCCESSFUL_BUY,
      tracking_code: null,
      postage_label: null,
    });
    const res = await POST(
      req(url, { method: "POST", headers: { authorization: "Bearer t" }, body: validBody }),
      authedParams(),
    );
    expect(res.status).toBe(502);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("returns 500 with tracking + labelUrl in the body when DB save fails (label was bought!)", async () => {
    // Critical edge case: the label IS bought (money spent) but Supabase
    // persist fails. The response must include the tracking number and
    // PDF URL so admin can copy them out of error_logs and proceed
    // manually rather than re-buying.
    mocks.buyLabel.mockResolvedValue(SUCCESSFUL_BUY);
    mocks.upsert.mockResolvedValue({ error: { message: "row level security" } });
    const res = await POST(
      req(url, { method: "POST", headers: { authorization: "Bearer t" }, body: validBody }),
      authedParams(),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.tracking).toBe("TRK999");
    expect(body.labelUrl).toBe("https://easypost.com/labels/abc.pdf");
  });
});
