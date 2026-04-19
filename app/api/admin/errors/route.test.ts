import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

const mockGetUser = vi.fn();
const rowsMock = vi.fn();

vi.mock("@supabase/supabase-js", () => {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(rowsMock()).then(resolve),
  };
  return {
    createClient: () => ({
      auth: { getUser: mockGetUser },
      from: vi.fn().mockReturnValue(queryBuilder),
    }),
  };
});

import { GET } from "./route";

function buildReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/admin/errors", { headers });
}

describe("app/api/admin/errors GET", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    rowsMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(buildReq());
    expect(res.status).toBe(401);
  });

  it("returns rows when authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    rowsMock.mockReturnValue({
      data: [
        { id: "1", level: "error", source: "api-route", path: "/x", message: "m", created_at: new Date().toISOString() },
      ],
      error: null,
    });
    const res = await GET(buildReq({ authorization: "Bearer tok" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].level).toBe("error");
  });

  it("returns empty rows when query returns empty data", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    rowsMock.mockReturnValue({ data: [], error: null });
    const res = await GET(buildReq({ authorization: "Bearer tok" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.nextCursor).toBeNull();
  });
});
