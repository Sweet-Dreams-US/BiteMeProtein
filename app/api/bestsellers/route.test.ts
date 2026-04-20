import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

const mocks = vi.hoisted(() => {
  const limit = vi.fn();
  return {
    limit,
    select: vi.fn(() => ({
      not: () => ({ limit: mocks.limit }),
    })),
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: mocks.select,
    }),
  }),
}));

import { GET } from "./route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function req(url: string, init: any = {}): NextRequest {
  return new NextRequest(url, init);
}

describe("app/api/bestsellers GET", () => {
  beforeEach(() => {
    mocks.limit.mockReset();
    mocks.select.mockClear();
  });

  it("returns empty + source='empty' when no line items exist", async () => {
    mocks.limit.mockResolvedValue({ data: [], error: null });
    const res = await GET(req("http://localhost/api/bestsellers"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.source).toBe("empty");
  });

  it("aggregates by name and sorts by total_sold desc", async () => {
    mocks.limit.mockResolvedValue({
      data: [
        { name: "Protein Brownies", quantity: "2" },
        { name: "Protein Brownies", quantity: "6" },
        { name: "Blueberry Protein Muffin", quantity: "1" },
        { name: "Protein Brownies", quantity: "1" },
        { name: "Blueberry Protein Muffin", quantity: "3" },
      ],
      error: null,
    });
    const res = await GET(req("http://localhost/api/bestsellers"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("sales");
    expect(body.items).toEqual([
      { name: "Protein Brownies", total_sold: 9 },
      { name: "Blueberry Protein Muffin", total_sold: 4 },
    ]);
  });

  it("respects ?limit and clamps to [1, 50]", async () => {
    mocks.limit.mockResolvedValue({
      data: [
        { name: "A", quantity: "5" },
        { name: "B", quantity: "3" },
        { name: "C", quantity: "1" },
      ],
      error: null,
    });
    const res = await GET(req("http://localhost/api/bestsellers?limit=2"));
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].name).toBe("A");
    expect(body.items[1].name).toBe("B");
  });

  it("treats non-numeric quantity as 0", async () => {
    mocks.limit.mockResolvedValue({
      data: [
        { name: "Weird Item", quantity: "not-a-number" },
        { name: "Weird Item", quantity: null },
        { name: "Real Item", quantity: "3" },
      ],
      error: null,
    });
    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    expect(body.items).toEqual([
      { name: "Real Item", total_sold: 3 },
      { name: "Weird Item", total_sold: 0 },
    ]);
  });

  it("returns 500 when the Supabase query errors", async () => {
    mocks.limit.mockResolvedValue({ data: null, error: { message: "db down" } });
    const res = await GET(req("http://localhost/api/bestsellers"));
    expect(res.status).toBe(500);
  });

  it("skips rows with empty or whitespace names", async () => {
    mocks.limit.mockResolvedValue({
      data: [
        { name: "   ", quantity: "100" },
        { name: "", quantity: "50" },
        { name: "Real", quantity: "1" },
      ],
      error: null,
    });
    const res = await GET(req("http://localhost/api/bestsellers"));
    const body = await res.json();
    expect(body.items).toEqual([{ name: "Real", total_sold: 1 }]);
  });
});
