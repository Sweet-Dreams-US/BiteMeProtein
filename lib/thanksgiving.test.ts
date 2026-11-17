import { describe, it, expect } from "vitest";
import { BITES, MENU, priceCart } from "./thanksgiving";

describe("priceCart", () => {
  it("prices pies by size and quantity", () => {
    const r = priceCart({ pies: [{ id: "cinna-bite-me", size: '12"', qty: 2 }, { id: "classic-apple-pie", size: '10"', qty: 1 }], boxes: [], bites: [] });
    expect(r.ok && r.cart.total).toBe(60 * 2 + 45);
    expect(r.ok && r.cart.itemCount).toBe(3);
  });

  it("rejects a size the pie doesn't come in", () => {
    const r = priceCart({ pies: [{ id: "apple-bottom-pie", size: '10"', qty: 1 }], boxes: [], bites: [] });
    expect(r.ok).toBe(false);
  });

  it("prices a full Gobble Box at the flat box price", () => {
    const r = priceCart({ pies: [], boxes: [{ count: 6, picks: { "pie-shots": 4, "gingersnap-swirls": 2 } }], bites: [] });
    expect(r.ok && r.cart.total).toBe(30);
  });

  it("rejects half-filled boxes and bites that can't go in a box", () => {
    expect(priceCart({ pies: [], boxes: [{ count: 12, picks: { "pie-shots": 11 } }], bites: [] }).ok).toBe(false);
    expect(priceCart({ pies: [], boxes: [{ count: 6, picks: { "apple-creme-brulee": 6 } }], bites: [] }).ok).toBe(false);
  });

  it("prices à la carte bites and rejects empty or unknown carts", () => {
    const r = priceCart({ pies: [], boxes: [], bites: [{ id: "talk-turkey-to-me", qty: 3 }] });
    expect(r.ok && r.cart.total).toBe(24);
    expect(priceCart({ pies: [], boxes: [], bites: [] }).ok).toBe(false);
    expect(priceCart({ pies: [{ id: "nope", size: '10"', qty: 1 }], boxes: [], bites: [] }).ok).toBe(false);
    expect(priceCart({ pies: [{ id: "cinna-bite-me", size: '10"', qty: 0 }], boxes: [], bites: [] }).ok).toBe(false);
  });

  it("keeps Mo&Ma Classics in their own category", () => {
    expect(MENU.filter((c) => c.line === "moma").map((c) => c.id)).toEqual(["classics"]);
    expect(BITES.filter((b) => b.inBox).every((b) => b.price === 5)).toBe(true);
  });
});
