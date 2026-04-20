import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

// vi.hoisted so these refs exist before the mock factories run
const mocks = vi.hoisted(() => ({
  upsertOrder: vi.fn().mockResolvedValue(undefined),
  upsertPayment: vi.fn().mockResolvedValue(undefined),
  upsertRefund: vi.fn().mockResolvedValue(undefined),
  upsertCustomer: vi.fn().mockResolvedValue(undefined),
  upsertProduct: vi.fn().mockResolvedValue(undefined),
  upsertCategory: vi.fn().mockResolvedValue(undefined),
  upsertModifier: vi.fn().mockResolvedValue(undefined),
  backfillCatalog: vi.fn().mockResolvedValue({ entity: "catalog", count: 0, durationMs: 0, errors: 0 }),
  upsertLoyaltyAccount: vi.fn().mockResolvedValue(undefined),
  upsertLoyaltyEvent: vi.fn().mockResolvedValue(undefined),
  upsertInventoryCount: vi.fn().mockResolvedValue(undefined),
  upsertLocation: vi.fn().mockResolvedValue(undefined),
  upsertGiftCard: vi.fn().mockResolvedValue(undefined),
  upsertDispute: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sync/orders", () => ({ upsertOrder: mocks.upsertOrder }));
vi.mock("@/lib/sync/payments", () => ({ upsertPayment: mocks.upsertPayment }));
vi.mock("@/lib/sync/refunds", () => ({ upsertRefund: mocks.upsertRefund }));
vi.mock("@/lib/sync/customers", () => ({ upsertCustomer: mocks.upsertCustomer }));
vi.mock("@/lib/sync/catalog", () => ({
  upsertProduct: mocks.upsertProduct,
  upsertCategory: mocks.upsertCategory,
  upsertModifier: mocks.upsertModifier,
  backfillCatalog: mocks.backfillCatalog,
}));
vi.mock("@/lib/sync/loyalty", () => ({
  upsertLoyaltyAccount: mocks.upsertLoyaltyAccount,
  upsertLoyaltyEvent: mocks.upsertLoyaltyEvent,
}));
vi.mock("@/lib/sync/inventory", () => ({ upsertInventoryCount: mocks.upsertInventoryCount }));
vi.mock("@/lib/sync/locations", () => ({ upsertLocation: mocks.upsertLocation }));
vi.mock("@/lib/sync/tier-c", () => ({
  upsertGiftCard: mocks.upsertGiftCard,
  upsertDispute: mocks.upsertDispute,
}));

const upsertOrder = mocks.upsertOrder;
const upsertPayment = mocks.upsertPayment;
const upsertCustomer = mocks.upsertCustomer;
const backfillCatalog = mocks.backfillCatalog;

import { POST } from "./route";

const KEY = "test-sig-key";
const URL = "http://localhost/api/webhooks/square";

function signedRequest(body: object, keyOverride?: string): NextRequest {
  const bodyText = JSON.stringify(body);
  const hmac = crypto.createHmac("sha256", keyOverride ?? KEY);
  hmac.update(URL + bodyText);
  const signature = hmac.digest("base64");
  return new NextRequest(URL, {
    method: "POST",
    headers: { "x-square-hmacsha256-signature": signature, "content-type": "application/json" },
    body: bodyText,
  });
}

describe("app/api/webhooks/square POST", () => {
  beforeEach(() => {
    vi.stubEnv("SQUARE_WEBHOOK_SIGNATURE_KEY", KEY);
    vi.stubEnv("SQUARE_WEBHOOK_NOTIFICATION_URL", URL);
    upsertOrder.mockClear();
    upsertPayment.mockClear();
    upsertCustomer.mockClear();
    backfillCatalog.mockClear();
  });

  it("returns 401 when signature is missing", async () => {
    const req = new NextRequest(URL, {
      method: "POST",
      body: JSON.stringify({ type: "order.created" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(upsertOrder).not.toHaveBeenCalled();
  });

  it("returns 401 when signature was computed with wrong key", async () => {
    const req = signedRequest({ type: "order.created", data: { object: { order_created: { id: "O_1" } } } }, "wrong-key");
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(upsertOrder).not.toHaveBeenCalled();
  });

  it("dispatches order.created → upsertOrder", async () => {
    const order = { id: "O_1", createdAt: "2026-04-19T10:00:00Z" };
    const req = signedRequest({ type: "order.created", event_id: "evt_1", data: { object: { order_created: order } } });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(upsertOrder).toHaveBeenCalledWith(order);
  });

  it("dispatches payment.updated → upsertPayment", async () => {
    const payment = { id: "P_1", createdAt: "2026-04-19T10:00:00Z" };
    const req = signedRequest({ type: "payment.updated", data: { object: { payment } } });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(upsertPayment).toHaveBeenCalledWith(payment);
  });

  it("triggers full catalog resync on catalog.version.updated", async () => {
    const req = signedRequest({ type: "catalog.version.updated", data: { object: {} } });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(backfillCatalog).toHaveBeenCalled();
  });

  it("returns 200 for unknown event types (no retry trigger)", async () => {
    const req = signedRequest({ type: "totally.unknown.event", data: { object: {} } });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(upsertOrder).not.toHaveBeenCalled();
  });

  it("idempotency: replaying the same event is safe", async () => {
    const order = { id: "O_IDEMP", createdAt: "2026-04-19T10:00:00Z" };
    const req1 = signedRequest({ type: "order.created", event_id: "evt_x", data: { object: { order_created: order } } });
    const req2 = signedRequest({ type: "order.created", event_id: "evt_x", data: { object: { order_created: order } } });
    await POST(req1);
    await POST(req2);
    // Handler is called twice — upsert itself is idempotent (onConflict: id).
    expect(upsertOrder).toHaveBeenCalledTimes(2);
    expect(upsertOrder).toHaveBeenNthCalledWith(1, order);
    expect(upsertOrder).toHaveBeenNthCalledWith(2, order);
  });
});
