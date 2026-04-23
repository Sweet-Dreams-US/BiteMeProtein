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

vi.mock("./square-client", () => ({
  getSquareClient: vi.fn(),
  paginate: vi.fn(),
  withRetry: vi.fn(),
}));

import { upsertOrder } from "./orders";

describe("lib/sync/orders", () => {
  beforeEach(() => {
    upsertMock.mockClear();
    deleteEqMock.mockClear();
    fromMock.mockClear();
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
});
