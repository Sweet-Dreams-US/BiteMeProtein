import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the `square` SDK so tests never try to hit the network.
vi.mock("square", () => {
  class SquareClient {
    config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
  }
  return {
    SquareClient,
    SquareEnvironment: {
      Production: "production",
      Sandbox: "sandbox",
    },
  };
});

describe("lib/square", () => {
  beforeEach(() => {
    vi.resetModules(); // reset the module-level singleton between tests
    vi.unstubAllEnvs();
  });

  it("creates a SquareClient on first call", async () => {
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "tok");
    vi.stubEnv("SQUARE_ENVIRONMENT", "sandbox");
    const mod = await import("./square");
    const client = mod.getSquareClient();
    expect(client).toBeTruthy();
  });

  it("returns the same singleton on subsequent calls", async () => {
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "tok");
    const mod = await import("./square");
    const a = mod.getSquareClient();
    const b = mod.getSquareClient();
    expect(a).toBe(b);
  });

  it("throws when SQUARE_ACCESS_TOKEN is missing", async () => {
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "");
    const mod = await import("./square");
    expect(() => mod.getSquareClient()).toThrow(/SQUARE_ACCESS_TOKEN/);
  });

  it("passes production environment when SQUARE_ENVIRONMENT=production", async () => {
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "tok");
    vi.stubEnv("SQUARE_ENVIRONMENT", "production");
    const mod = await import("./square");
    const client = mod.getSquareClient() as unknown as { config: { environment: string } };
    expect(client.config.environment).toBe("production");
  });

  it("defaults to sandbox when SQUARE_ENVIRONMENT is unset", async () => {
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "tok");
    vi.stubEnv("SQUARE_ENVIRONMENT", "");
    const mod = await import("./square");
    const client = mod.getSquareClient() as unknown as { config: { environment: string } };
    expect(client.config.environment).toBe("sandbox");
  });

  it("getLocationId throws when SQUARE_LOCATION_ID is missing", async () => {
    vi.stubEnv("SQUARE_LOCATION_ID", "");
    const mod = await import("./square");
    expect(() => mod.getLocationId()).toThrow(/SQUARE_LOCATION_ID/);
  });

  it("getLocationId returns trimmed value", async () => {
    vi.stubEnv("SQUARE_LOCATION_ID", "  LOC123  ");
    const mod = await import("./square");
    expect(mod.getLocationId()).toBe("LOC123");
  });

  it("getApplicationId returns empty string when unset (does not throw)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SQUARE_APPLICATION_ID", "");
    // Note: getApplicationId reads from SQUARE_APPLICATION_ID (no NEXT_PUBLIC prefix
    // in square.ts). Kept as-is to document current behavior; see code.
    vi.stubEnv("SQUARE_APPLICATION_ID", "");
    const mod = await import("./square");
    expect(mod.getApplicationId()).toBe("");
  });
});
