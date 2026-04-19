import { describe, it, expect, beforeEach, vi } from "vitest";

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

describe("lib/log-error", () => {
  beforeEach(() => {
    vi.resetModules();
    mockInsert.mockReset();
    mockFrom.mockClear();
  });

  it("inserts a row with the expected shape for an Error", async () => {
    mockInsert.mockResolvedValue({ error: null });
    const { logError } = await import("./log-error");

    const err = new Error("boom");
    await logError(err, {
      path: "/api/test",
      source: "api-route",
      context: { foo: "bar" },
    });

    expect(mockFrom).toHaveBeenCalledWith("error_logs");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        source: "api-route",
        path: "/api/test",
        message: "boom",
        context: { foo: "bar" },
      }),
    );
    // stack is included for Error instances
    const call = mockInsert.mock.calls[0][0];
    expect(typeof call.stack).toBe("string");
    expect(call.stack).toContain("Error: boom");
  });

  it("defaults level to 'error' and source to 'lib'", async () => {
    mockInsert.mockResolvedValue({ error: null });
    const { logError } = await import("./log-error");

    await logError(new Error("x"), { path: "lib/x.ts:foo" });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error", source: "lib" }),
    );
  });

  it("handles non-Error values (strings, objects)", async () => {
    mockInsert.mockResolvedValue({ error: null });
    const { logError } = await import("./log-error");

    await logError("something bad", { path: "/x" });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ message: "something bad", stack: null }),
    );

    mockInsert.mockClear();
    await logError({ code: 500, reason: "nope" }, { path: "/y" });
    const row = mockInsert.mock.calls[0][0];
    expect(typeof row.message).toBe("string");
    expect(row.message).toContain("500");
  });

  it("never throws when Supabase insert fails", async () => {
    mockInsert.mockRejectedValue(new Error("db is down"));
    const { logError } = await import("./log-error");

    await expect(
      logError(new Error("boom"), { path: "/api/test" }),
    ).resolves.toBeUndefined();
  });

  it("never throws when Supabase returns an error payload", async () => {
    mockInsert.mockResolvedValue({ error: { message: "rls denied" } });
    const { logError } = await import("./log-error");

    await expect(
      logError(new Error("boom"), { path: "/api/test" }),
    ).resolves.toBeUndefined();
  });

  it("skips insert silently when service-role env is missing", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { logError } = await import("./log-error");

    await logError(new Error("boom"), { path: "/api/test" });
    expect(mockFrom).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
