import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

// Mock Supabase: .from() returns a chainable builder with .select/.eq/.maybeSingle/.order
const zoneMock = vi.fn();
const ratesMock = vi.fn();

vi.mock("@supabase/supabase-js", () => {
  const eqReturn = () => chain;
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation(eqReturn),
    order: vi.fn().mockImplementation(() => ratesMock()),
    maybeSingle: vi.fn().mockImplementation(() => zoneMock()),
  };
  return {
    createClient: () => ({
      from: vi.fn().mockReturnValue(chain),
    }),
  };
});

import { GET } from "./route";

function req(url: string): NextRequest {
  return new NextRequest(url);
}

describe("app/api/shipping/rates GET", () => {
  beforeEach(() => {
    zoneMock.mockReset();
    ratesMock.mockReset();
  });

  it("returns 400 when zip is missing", async () => {
    const res = await GET(req("http://localhost/api/shipping/rates"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ZIP/i);
  });

  it("returns 400 when zip is shorter than 5 digits", async () => {
    const res = await GET(req("http://localhost/api/shipping/rates?zip=123"));
    expect(res.status).toBe(400);
  });

  it("uses 'national' as the zone fallback when ZIP prefix is unknown", async () => {
    zoneMock.mockResolvedValue({ data: null, error: null });
    ratesMock.mockResolvedValue({ data: [{ service: "FedEx 2Day", price_cents: 1999 }], error: null });

    const res = await GET(req("http://localhost/api/shipping/rates?zip=99999"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.zone).toBe("national");
    expect(body.options).toEqual([{ service: "FedEx 2Day", priceCents: 1999 }]);
  });

  it("uses the ZIP's zone when found", async () => {
    zoneMock.mockResolvedValue({ data: { zone: "zone3" }, error: null });
    ratesMock.mockResolvedValue({
      data: [
        { service: "Express Saver", price_cents: 2499 },
        { service: "2Day", price_cents: 1999 },
      ],
      error: null,
    });

    const res = await GET(req("http://localhost/api/shipping/rates?zip=33411&boxType=Medium%20Box"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.zone).toBe("zone3");
    expect(body.boxType).toBe("Medium Box");
    expect(body.options).toHaveLength(2);
  });

  it("returns 500 when rates query errors", async () => {
    zoneMock.mockResolvedValue({ data: { zone: "zone3" }, error: null });
    ratesMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    const res = await GET(req("http://localhost/api/shipping/rates?zip=33411"));
    expect(res.status).toBe(500);
  });
});
