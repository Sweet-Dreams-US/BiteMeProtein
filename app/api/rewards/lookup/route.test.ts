import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

const fixtures = vi.hoisted(() => ({
  customerByEmail: null as any,
  customerByPhone: null as any,
  dealsRow: null as any,
  loyaltyBalance: null as any,
  loyaltyProgram: null as any,
}));

vi.mock("@/lib/loyalty", () => ({
  getLoyaltyBalance: async () => fixtures.loyaltyBalance,
  getLoyaltyProgram: async () => fixtures.loyaltyProgram,
  normalizePhone: (raw: string | null | undefined) => {
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return null;
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      if (table === "square_customers") {
        // Tests set customerByEmail / customerByPhone based on which lookup to simulate
        return {
          select: () => ({
            ilike: () => ({
              not: () => ({ limit: () => ({ maybeSingle: async () => ({ data: fixtures.customerByEmail, error: null }) }) }),
            }),
            eq: () => ({
              limit: () => ({ maybeSingle: async () => ({ data: fixtures.customerByPhone, error: null }) }),
            }),
          }),
        };
      }
      if (table === "cms_content") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: fixtures.dealsRow, error: null }) }),
          }),
        };
      }
      throw new Error(`unmocked table: ${table}`);
    },
  }),
}));

import { POST } from "./route";

function req(body: any): NextRequest {
  return new NextRequest("http://localhost/api/rewards/lookup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function reset() {
  fixtures.customerByEmail = null;
  fixtures.customerByPhone = null;
  fixtures.dealsRow = null;
  fixtures.loyaltyBalance = null;
  fixtures.loyaltyProgram = { id: "p1", terminology: { one: "Star", other: "Stars" }, rewardTiers: [] };
}

describe("app/api/rewards/lookup POST", () => {
  beforeEach(reset);

  it("200 found:false when input is empty", async () => {
    const res = await POST(req({ input: "" }));
    const body = await res.json();
    expect(body.found).toBe(false);
  });

  it("200 found:false when input is gibberish (not email, not phone)", async () => {
    const res = await POST(req({ input: "abc123" }));
    const body = await res.json();
    expect(body.found).toBe(false);
    expect(body.reason).toMatch(/valid email or .*phone/i);
  });

  it("looks up by phone when input looks like a phone", async () => {
    fixtures.loyaltyBalance = { points: 7, lifetimePoints: 22, accountId: "la_1" };
    const res = await POST(req({ input: "(555) 867-5309" }));
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.phone).toBe("+15558675309");
    expect(body.points).toBe(7);
    expect(body.lifetimePoints).toBe(22);
  });

  it("looks up by email when input looks like an email, resolves phone from square_customers", async () => {
    fixtures.customerByEmail = { phone: "+15558675309", email: "jamie@example.com" };
    fixtures.loyaltyBalance = { points: 3, lifetimePoints: 5, accountId: "la_2" };
    const res = await POST(req({ input: "jamie@example.com" }));
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.phone).toBe("+15558675309");
    expect(body.email).toBe("jamie@example.com");
    expect(body.points).toBe(3);
  });

  it("200 found:false when email doesn't match any customer phone", async () => {
    fixtures.customerByEmail = null;
    const res = await POST(req({ input: "nobody@example.com" }));
    const body = await res.json();
    expect(body.found).toBe(false);
    expect(body.reason).toMatch(/rewards account/i);
  });

  it("returns featuredDeals from cms_content when present", async () => {
    fixtures.loyaltyBalance = { points: 2, lifetimePoints: 2, accountId: "la_3" };
    fixtures.dealsRow = {
      value: [
        { title: "Trainer code", description: "Ask Haley for the code" },
        "Free delivery over $50",
      ],
    };
    const res = await POST(req({ input: "5558675309" }));
    const body = await res.json();
    expect(body.featuredDeals).toHaveLength(2);
    expect(body.featuredDeals[0]).toMatchObject({ title: "Trainer code" });
  });

  it("returns empty featuredDeals when cms key not set or not an array", async () => {
    fixtures.loyaltyBalance = { points: 0, lifetimePoints: 0, accountId: "la_4" };
    fixtures.dealsRow = null; // no override row
    const res = await POST(req({ input: "5558675309" }));
    const body = await res.json();
    expect(body.featuredDeals).toEqual([]);
  });

  it("returns reason when loyalty program is not configured", async () => {
    fixtures.loyaltyProgram = null;
    const res = await POST(req({ input: "5558675309" }));
    const body = await res.json();
    expect(body.found).toBe(false);
    expect(body.reason).toMatch(/rewards program/i);
  });

  it("includes email lookup even when input was phone (for Email-me button convenience)", async () => {
    fixtures.loyaltyBalance = { points: 10, lifetimePoints: 10, accountId: "la_5" };
    fixtures.customerByPhone = { email: "jamie@example.com" };
    const res = await POST(req({ input: "5558675309" }));
    const body = await res.json();
    expect(body.email).toBe("jamie@example.com");
  });

  it("returns points=0 when balance lookup returns null (no loyalty account yet)", async () => {
    fixtures.loyaltyBalance = null;
    const res = await POST(req({ input: "5558675309" }));
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.points).toBe(0);
    expect(body.lifetimePoints).toBe(0);
  });
});
