import { describe, it, expect, beforeEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock the service-role Supabase client. Tests control what the "discount_codes"
// lookup + the "discount_redemptions" count queries return per test.
const fixtures = vi.hoisted(() => ({
  discountRow: null as any,
  discountError: null as any,
  redemptionCount: 0,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "discount_codes") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: fixtures.discountRow, error: fixtures.discountError }),
            }),
          }),
        };
      }
      if (table === "discount_redemptions") {
        return {
          select: () => ({
            eq: () => ({
              count: fixtures.redemptionCount,
              // For chained ilike (max_per_customer path) — still returns count
              ilike: () => Promise.resolve({ count: fixtures.redemptionCount, error: null }),
              // Terminal await returns count
              then: (resolve: (value: { count: number; error: null }) => unknown) =>
                Promise.resolve({ count: fixtures.redemptionCount, error: null }).then(resolve),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      throw new Error(`unmocked table: ${table}`);
    },
  }),
}));

import { validateAndApply, type CartBundle } from "./discount-codes";

const BITE_ME_TRAINING = {
  id: "d_1",
  code: "BiteMeTraining",
  name: "Trainer referral — $5/item pickup",
  discount_type: "per_item_fixed_price",
  amount_cents: 500,
  percent: null,
  fulfillment_restriction: "pickup",
  product_scope: "all",
  allowed_square_product_ids: null,
  starts_at: null,
  ends_at: null,
  max_total_uses: null,
  max_per_customer: null,
  is_active: true,
  notes: null,
};

const sixPack: CartBundle = {
  tierName: "6-Pack",
  priceCents: 3800,
  items: [
    { variationId: "V_BROWNIE", name: "Protein Brownie", quantity: 3 },
    { variationId: "V_MUFFIN", name: "Blueberry Muffin", quantity: 3 },
  ],
};

function reset() {
  fixtures.discountRow = null;
  fixtures.discountError = null;
  fixtures.redemptionCount = 0;
}

describe("lib/discount-codes — validateAndApply", () => {
  beforeEach(reset);

  it("rejects empty code", async () => {
    const r = await validateAndApply({ code: "  ", bundles: [sixPack], items: [], orderType: "pickup" });
    expect(r.valid).toBe(false);
  });

  it("rejects unknown code", async () => {
    fixtures.discountRow = null;
    const r = await validateAndApply({ code: "BOGUS", bundles: [sixPack], items: [], orderType: "pickup" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/not found/i);
  });

  it("rejects when is_active is false", async () => {
    fixtures.discountRow = { ...BITE_ME_TRAINING, is_active: false };
    const r = await validateAndApply({ code: "BiteMeTraining", bundles: [sixPack], items: [], orderType: "pickup" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/not.*active/i);
  });

  it("rejects before starts_at", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    fixtures.discountRow = { ...BITE_ME_TRAINING, starts_at: future };
    const r = await validateAndApply({ code: "BiteMeTraining", bundles: [sixPack], items: [], orderType: "pickup" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/not yet active/i);
  });

  it("rejects after ends_at", async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    fixtures.discountRow = { ...BITE_ME_TRAINING, ends_at: past };
    const r = await validateAndApply({ code: "BiteMeTraining", bundles: [sixPack], items: [], orderType: "pickup" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/expired/i);
  });

  it("rejects pickup-only code on shipping order", async () => {
    fixtures.discountRow = BITE_ME_TRAINING; // fulfillment_restriction = "pickup"
    const r = await validateAndApply({ code: "BiteMeTraining", bundles: [sixPack], items: [], orderType: "shipping" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/pickup/i);
  });

  it("applies $5-per-item to a 6-pack bundle on pickup", async () => {
    fixtures.discountRow = BITE_ME_TRAINING;
    const r = await validateAndApply({ code: "BiteMeTraining", bundles: [sixPack], items: [], orderType: "pickup" });
    expect(r.valid).toBe(true);
    if (!r.valid) return;
    // 6 items × $5 = $30 = 3000 cents. Original was 3800. Savings = 800.
    expect(r.adjustedBundles[0].priceCents).toBe(3000);
    expect(r.amountCentsSaved).toBe(800);
    expect(r.summary).toMatch(/\$5\.00/);
  });

  it("sums savings across multiple bundles", async () => {
    fixtures.discountRow = BITE_ME_TRAINING;
    const bundle2: CartBundle = {
      tierName: "12-Pack",
      priceCents: 7000, // normal
      items: [{ variationId: "V_BROWNIE", name: "Brownie", quantity: 12 }],
    };
    const r = await validateAndApply({
      code: "BiteMeTraining",
      bundles: [sixPack, bundle2],
      items: [],
      orderType: "pickup",
    });
    expect(r.valid).toBe(true);
    if (!r.valid) return;
    // 6-pack: 3800 → 3000 (saved 800). 12-pack: 7000 → 6000 (saved 1000). Total = 1800.
    expect(r.amountCentsSaved).toBe(1800);
    expect(r.adjustedBundles[0].priceCents).toBe(3000);
    expect(r.adjustedBundles[1].priceCents).toBe(6000);
  });

  it("rejects cleanly when no bundles qualify (empty cart for per-item discount)", async () => {
    fixtures.discountRow = BITE_ME_TRAINING;
    const r = await validateAndApply({ code: "BiteMeTraining", bundles: [], items: [], orderType: "pickup" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/doesn't apply/i);
  });

  it("rejects allowlist scope when no bundle items match", async () => {
    fixtures.discountRow = {
      ...BITE_ME_TRAINING,
      product_scope: "allowlist",
      allowed_square_product_ids: ["V_DIFFERENT"],
    };
    const r = await validateAndApply({ code: "BiteMeTraining", bundles: [sixPack], items: [], orderType: "pickup" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/doesn't apply/i);
  });

  it("applies allowlist when at least one bundle item matches", async () => {
    fixtures.discountRow = {
      ...BITE_ME_TRAINING,
      product_scope: "allowlist",
      allowed_square_product_ids: ["V_BROWNIE"], // sixPack includes V_BROWNIE
    };
    const r = await validateAndApply({ code: "BiteMeTraining", bundles: [sixPack], items: [], orderType: "pickup" });
    expect(r.valid).toBe(true);
    if (!r.valid) return;
    expect(r.amountCentsSaved).toBe(800);
  });

  it("rejects percent_off type (not yet applied at checkout)", async () => {
    fixtures.discountRow = {
      ...BITE_ME_TRAINING,
      discount_type: "percent_off",
      amount_cents: null,
      percent: 20,
    };
    const r = await validateAndApply({ code: "anyPercentOff", bundles: [sixPack], items: [], orderType: "pickup" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/supported/i);
  });

  it("rejects when max_total_uses is reached", async () => {
    fixtures.discountRow = { ...BITE_ME_TRAINING, max_total_uses: 5 };
    fixtures.redemptionCount = 5;
    const r = await validateAndApply({ code: "BiteMeTraining", bundles: [sixPack], items: [], orderType: "pickup" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/usage limit/i);
  });

  it("rejects misconfigured per_item_fixed_price (null amount_cents)", async () => {
    fixtures.discountRow = { ...BITE_ME_TRAINING, amount_cents: null };
    const r = await validateAndApply({ code: "BiteMeTraining", bundles: [sixPack], items: [], orderType: "pickup" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/misconfigured/i);
  });
});
