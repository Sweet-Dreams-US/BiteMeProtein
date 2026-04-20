import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

const upsertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn(() => ({ upsert: upsertMock }));

vi.mock("./supabase-admin", () => ({
  getAdminSupabase: () => ({ from: fromMock }),
}));

vi.mock("./square-client", () => ({
  getSquareClient: vi.fn(),
  paginate: vi.fn(),
  withRetry: vi.fn(),
}));

import { upsertPayment } from "./payments";

describe("lib/sync/payments", () => {
  beforeEach(() => { upsertMock.mockClear(); fromMock.mockClear(); });

  it("captures source_type — the POS vs online distinguisher", async () => {
    await upsertPayment({
      id: "PAY_1",
      orderId: "ORD_1",
      createdAt: "2026-04-19T10:00:00Z",
      amountMoney: { amount: 3899 },
      sourceType: "CASH",
      status: "COMPLETED",
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "PAY_1", source_type: "CASH", amount_cents: 3899 }),
      { onConflict: "id" },
    );
  });

  it("extracts card brand + last4 when CARD", async () => {
    await upsertPayment({
      id: "PAY_2",
      createdAt: "2026-04-19T10:00:00Z",
      sourceType: "CARD",
      cardDetails: { card: { cardBrand: "VISA", last4: "4242" } },
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ card_brand: "VISA", card_last_4: "4242" }),
      { onConflict: "id" },
    );
  });
});
