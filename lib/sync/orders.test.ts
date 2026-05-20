import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

const upsertMock = vi.fn().mockResolvedValue({ error: null });
const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
// upsertOrder now reads existing event_id before upserting (to preserve
// manually-assigned event tags across resyncs) and queries events for the
// date-overlap auto-tag. Both chains terminate in maybeSingle / a plain
// thenable depending on the path, so mock both shapes.
const fromMock = vi.fn((table: string) => {
  if (table === "square_orders") {
    return {
      upsert: upsertMock,
      delete: () => ({ eq: deleteEqMock }),
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    };
  }
  if (table === "events") {
    // Empty events list → auto-tag finds no match (path returns null early)
    return {
      select: () => ({
        lte: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    };
  }
  if (table === "square_order_line_items") {
    return {
      upsert: upsertMock,
      delete: () => ({ eq: deleteEqMock }),
    };
  }
  // Default — any other table lookups
  return { upsert: upsertMock };
});

vi.mock("./supabase-admin", () => ({
  getAdminSupabase: () => ({ from: fromMock }),
}));

// Square client mock. ordersGet is the SDK's client.orders.get — used by
// syncOrderById to fetch a full order. withRetry passes straight through
// so the wrapped call still runs. paginate is unused by these tests.
const squareMocks = vi.hoisted(() => ({
  ordersGet: vi.fn(),
}));
vi.mock("./square-client", () => ({
  getSquareClient: () => ({ orders: { get: squareMocks.ordersGet } }),
  paginate: vi.fn(),
  withRetry: (fn: () => unknown) => fn(),
}));

import { upsertOrder, syncOrderById } from "./orders";

describe("lib/sync/orders", () => {
  beforeEach(() => {
    upsertMock.mockClear();
    deleteEqMock.mockClear();
    fromMock.mockClear();
    squareMocks.ordersGet.mockReset();
  });

  it("writes the expected order row shape", async () => {
    await upsertOrder({
      id: "ORD_123",
      createdAt: "2026-04-19T10:00:00Z",
      updatedAt: "2026-04-19T10:05:00Z",
      state: "COMPLETED",
      locationId: "LOC_1",
      customerId: "CUST_1",
      totalMoney: { amount: 3899, currency: "USD" },
      totalTaxMoney: { amount: 274, currency: "USD" },
      source: { name: "Square Point of Sale" },
      version: 3,
      lineItems: [],
    });

    expect(fromMock).toHaveBeenCalledWith("square_orders");
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ORD_123",
        state: "COMPLETED",
        location_id: "LOC_1",
        customer_id: "CUST_1",
        total_money_cents: 3899,
        total_tax_cents: 274,
        source_name: "Square Point of Sale",
        version: 3,
      }),
      { onConflict: "id" },
    );
  });

  it("upserts line items after replacing existing", async () => {
    await upsertOrder({
      id: "ORD_456",
      createdAt: "2026-04-19T10:00:00Z",
      updatedAt: "2026-04-19T10:05:00Z",
      lineItems: [
        { uid: "LI_1", name: "Brownie", quantity: "2", basePriceMoney: { amount: 800 } },
        { uid: "LI_2", name: "Muffin", quantity: "1", basePriceMoney: { amount: 500 } },
      ],
    });

    // The first from() call is for square_orders, the second for delete + third for line items upsert
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromCalls = (fromMock.mock.calls as any[][]).map((c) => c[0]);
    expect(fromCalls).toContain("square_orders");
    expect(fromCalls).toContain("square_order_line_items");

    // Assert one of the upsert calls included our line items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = upsertMock.mock.calls as any[][];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineItemUpsert: any[] | undefined = calls.find(
      (c) => Array.isArray(c[0]) && c[0].some((row: { id: string }) => row.id === "LI_1"),
    );
    expect(lineItemUpsert).toBeTruthy();
    expect(lineItemUpsert![0]).toHaveLength(2);
  });

  it("no-ops when id is missing (idempotent safety)", async () => {
    await upsertOrder({ createdAt: "2026-04-19T10:00:00Z" });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("tolerates missing money fields (null not NaN)", async () => {
    await upsertOrder({
      id: "ORD_999",
      createdAt: "2026-04-19T10:00:00Z",
      updatedAt: "2026-04-19T10:00:00Z",
      // no totalMoney
    });
    const row = upsertMock.mock.calls[0][0];
    expect(row.total_money_cents).toBeNull();
  });

  // ── syncOrderById — the webhook's order path ────────────────────────
  // Square's order.* webhooks are thin notifications (order_id only), so
  // the webhook handler calls syncOrderById to fetch the full order.
  describe("syncOrderById", () => {
    it("fetches the full order from Square and upserts it", async () => {
      squareMocks.ordersGet.mockResolvedValue({
        order: {
          id: "ORD_FETCH",
          createdAt: "2026-05-10T10:00:00Z",
          updatedAt: "2026-05-10T10:05:00Z",
          state: "COMPLETED",
          totalMoney: { amount: 1500, currency: "USD" },
          lineItems: [],
        },
      });

      await syncOrderById("ORD_FETCH");

      // Called the SDK with the right id
      expect(squareMocks.ordersGet).toHaveBeenCalledWith({ orderId: "ORD_FETCH" });
      // And upserted the resolved full order
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "ORD_FETCH",
          state: "COMPLETED",
          total_money_cents: 1500,
        }),
        { onConflict: "id" },
      );
    });

    it("no-ops on an empty orderId (never hits Square)", async () => {
      await syncOrderById("");
      expect(squareMocks.ordersGet).not.toHaveBeenCalled();
      expect(upsertMock).not.toHaveBeenCalled();
    });

    it("skips the upsert when Square returns no order", async () => {
      squareMocks.ordersGet.mockResolvedValue({ order: null });
      await syncOrderById("ORD_GONE");
      expect(squareMocks.ordersGet).toHaveBeenCalledWith({ orderId: "ORD_GONE" });
      expect(upsertMock).not.toHaveBeenCalled();
    });

    it("propagates fetch failures so the webhook 500s and Square retries", async () => {
      squareMocks.ordersGet.mockRejectedValue(new Error("Square 503"));
      await expect(syncOrderById("ORD_FLAKY")).rejects.toThrow("Square 503");
    });
  });
});
