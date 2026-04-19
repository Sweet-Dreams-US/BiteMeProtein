import { describe, it, expect, beforeEach, vi } from "vitest";

// Don't write to Supabase in tests — stub logError to a no-op.
vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

// Mock Square client. Each test sets the relevant mock return value.
const mockProgramsGet = vi.fn();
const mockAccountsSearch = vi.fn();
const mockAccountsCreate = vi.fn();
const mockAccountsAccumulate = vi.fn();

vi.mock("@/lib/square", () => ({
  getSquareClient: () => ({
    loyalty: {
      programs: { get: mockProgramsGet },
      accounts: {
        search: mockAccountsSearch,
        create: mockAccountsCreate,
        accumulatePoints: mockAccountsAccumulate,
      },
    },
  }),
}));

describe("lib/loyalty", () => {
  beforeEach(() => {
    vi.resetModules(); // reset module-level cache
    mockProgramsGet.mockReset();
    mockAccountsSearch.mockReset();
    mockAccountsCreate.mockReset();
    mockAccountsAccumulate.mockReset();
  });

  describe("normalizePhone", () => {
    it("returns +1-prefixed E.164 for 10-digit US numbers", async () => {
      const { normalizePhone } = await import("./loyalty");
      expect(normalizePhone("5551234567")).toBe("+15551234567");
      expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
      expect(normalizePhone("555.123.4567")).toBe("+15551234567");
    });

    it("handles 11-digit numbers with leading 1", async () => {
      const { normalizePhone } = await import("./loyalty");
      expect(normalizePhone("15551234567")).toBe("+15551234567");
    });

    it("preserves + prefix when already E.164", async () => {
      const { normalizePhone } = await import("./loyalty");
      expect(normalizePhone("+442071838750")).toBe("+442071838750");
    });

    it("returns null for too-short numbers", async () => {
      const { normalizePhone } = await import("./loyalty");
      expect(normalizePhone("12345")).toBeNull();
      expect(normalizePhone("")).toBeNull();
      expect(normalizePhone(null)).toBeNull();
      expect(normalizePhone(undefined)).toBeNull();
    });
  });

  describe("getLoyaltyProgramId", () => {
    it("calls client.loyalty.programs.get (not getProgram — regression guard for 08c01dc)", async () => {
      mockProgramsGet.mockResolvedValue({ program: { id: "prog_abc" } });
      const { getLoyaltyProgramId } = await import("./loyalty");
      const id = await getLoyaltyProgramId();
      expect(id).toBe("prog_abc");
      expect(mockProgramsGet).toHaveBeenCalledWith({ programId: "main" });
    });

    it("returns null when SDK throws", async () => {
      mockProgramsGet.mockRejectedValue(new TypeError("getProgram is not a function"));
      const { getLoyaltyProgramId } = await import("./loyalty");
      const id = await getLoyaltyProgramId();
      expect(id).toBeNull();
    });

    it("returns null when program missing from response", async () => {
      mockProgramsGet.mockResolvedValue({});
      const { getLoyaltyProgramId } = await import("./loyalty");
      expect(await getLoyaltyProgramId()).toBeNull();
    });

    it("caches within TTL (regression guard for aa3e813)", async () => {
      mockProgramsGet.mockResolvedValue({ program: { id: "prog_1" } });
      const { getLoyaltyProgramId } = await import("./loyalty");

      await getLoyaltyProgramId();
      await getLoyaltyProgramId();
      await getLoyaltyProgramId();
      expect(mockProgramsGet).toHaveBeenCalledTimes(1);
    });
  });

  describe("findOrCreateLoyaltyAccount", () => {
    it("returns null when phone can't be normalized", async () => {
      const { findOrCreateLoyaltyAccount } = await import("./loyalty");
      expect(await findOrCreateLoyaltyAccount("123")).toBeNull();
      expect(mockProgramsGet).not.toHaveBeenCalled();
    });

    it("returns null when no program is configured", async () => {
      mockProgramsGet.mockResolvedValue({});
      const { findOrCreateLoyaltyAccount } = await import("./loyalty");
      expect(await findOrCreateLoyaltyAccount("5551234567")).toBeNull();
    });

    it("returns existing account id when one is found for the phone", async () => {
      mockProgramsGet.mockResolvedValue({ program: { id: "prog_1" } });
      mockAccountsSearch.mockResolvedValue({
        loyaltyAccounts: [{ id: "acc_xyz" }],
      });
      const { findOrCreateLoyaltyAccount } = await import("./loyalty");
      expect(await findOrCreateLoyaltyAccount("5551234567")).toBe("acc_xyz");
      expect(mockAccountsCreate).not.toHaveBeenCalled();
    });

    it("creates a new account when none exists", async () => {
      mockProgramsGet.mockResolvedValue({ program: { id: "prog_1" } });
      mockAccountsSearch.mockResolvedValue({ loyaltyAccounts: [] });
      mockAccountsCreate.mockResolvedValue({ loyaltyAccount: { id: "acc_new" } });
      const { findOrCreateLoyaltyAccount } = await import("./loyalty");
      expect(await findOrCreateLoyaltyAccount("5551234567")).toBe("acc_new");
      expect(mockAccountsCreate).toHaveBeenCalled();
    });
  });

  describe("accumulatePointsForOrder", () => {
    it("uses a stable idempotency key per order (regression guard: no double-accrual)", async () => {
      mockProgramsGet.mockResolvedValue({ program: { id: "prog_1" } });
      mockAccountsSearch.mockResolvedValue({ loyaltyAccounts: [{ id: "acc_1" }] });
      mockAccountsAccumulate.mockResolvedValue({ event: { accumulatePoints: { points: 5 } } });

      const { accumulatePointsForOrder } = await import("./loyalty");
      await accumulatePointsForOrder({
        phoneNumber: "5551234567",
        orderId: "ord_xyz",
        locationId: "loc_a",
      });

      expect(mockAccountsAccumulate).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "order-ord_xyz",
          accountId: "acc_1",
          locationId: "loc_a",
        }),
      );
    });

    it("returns null (silent no-op) when phone normalization fails", async () => {
      const { accumulatePointsForOrder } = await import("./loyalty");
      const result = await accumulatePointsForOrder({
        phoneNumber: "abc",
        orderId: "ord_xyz",
        locationId: "loc_a",
      });
      expect(result).toBeNull();
    });
  });
});
