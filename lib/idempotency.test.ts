import { describe, it, expect } from "vitest";
import { deriveIdempotencyKeys } from "./idempotency";

describe("deriveIdempotencyKeys", () => {
  it("uses the client-supplied UUID for both keys with distinct suffixes", () => {
    const key = "a1b2c3d4-1234-1234-1234-abcdefabcdef";
    const { order, payment } = deriveIdempotencyKeys(key);
    expect(order).toBe(`${key}-o`);
    expect(payment).toBe(`${key}-p`);
    expect(order).not.toBe(payment);
  });

  it("returns keys under Square's 45-char limit", () => {
    const key = crypto.randomUUID();
    const { order, payment } = deriveIdempotencyKeys(key);
    expect(order.length).toBeLessThanOrEqual(45);
    expect(payment.length).toBeLessThanOrEqual(45);
  });

  it("falls back to a fresh UUID when the client key is missing", () => {
    const a = deriveIdempotencyKeys(undefined);
    const b = deriveIdempotencyKeys(undefined);
    // Each call gets its own fresh key — no dedup between cold clients
    expect(a.order).not.toBe(b.order);
    expect(a.order).toMatch(/-o$/);
    expect(a.payment).toMatch(/-p$/);
  });

  it("falls back to a fresh UUID when the client key is malformed", () => {
    // Bad actor sends something that would collide with another order's key
    const result = deriveIdempotencyKeys("'; DROP TABLE orders; --");
    expect(result.order).toMatch(/^[a-f0-9-]+-o$/);
    expect(result.payment).toMatch(/^[a-f0-9-]+-p$/);
  });

  it("falls back when the client key is too short to be a UUID", () => {
    const result = deriveIdempotencyKeys("abc");
    // The fallback UUID shape matches
    expect(result.order.length).toBeGreaterThan(20);
  });

  it("the same client key produces the same derived keys (idempotent)", () => {
    const key = "abcd1234-0000-0000-0000-000000000000";
    const first = deriveIdempotencyKeys(key);
    const second = deriveIdempotencyKeys(key);
    expect(first).toEqual(second);
  });
});
