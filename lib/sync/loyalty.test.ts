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

import { upsertLoyaltyAccount, upsertLoyaltyEvent } from "./loyalty";

describe("lib/sync/loyalty — accounts", () => {
  beforeEach(() => { upsertMock.mockClear(); fromMock.mockClear(); });

  it("captures phone from mapping.phoneNumber (the actual Square field)", async () => {
    await upsertLoyaltyAccount({
      id: "LOY_1",
      customerId: "CUST_1",
      programId: "PROG_1",
      mapping: { phoneNumber: "+15551234567" },
      balance: 12,
      lifetimePoints: 40,
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "LOY_1",
        customer_id: "CUST_1",
        phone: "+15551234567",
        balance: 12,
        lifetime_points: 40,
      }),
      { onConflict: "id" },
    );
  });
});

describe("lib/sync/loyalty — events", () => {
  beforeEach(() => { upsertMock.mockClear(); fromMock.mockClear(); });

  it("extracts points from accumulatePoints for ACCUMULATE_POINTS events", async () => {
    await upsertLoyaltyEvent({
      id: "EVT_1",
      loyaltyAccountId: "LOY_1",
      type: "ACCUMULATE_POINTS",
      createdAt: "2026-04-19T10:00:00Z",
      accumulatePoints: { points: 3, orderId: "ORD_1" },
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ points: 3, order_id: "ORD_1", type: "ACCUMULATE_POINTS" }),
      { onConflict: "id" },
    );
  });

  it("handles REDEEM_REWARD events", async () => {
    await upsertLoyaltyEvent({
      id: "EVT_2",
      type: "REDEEM_REWARD",
      createdAt: "2026-04-19T10:00:00Z",
      redeemReward: { points: -400 },
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ points: -400, type: "REDEEM_REWARD" }),
      { onConflict: "id" },
    );
  });
});
