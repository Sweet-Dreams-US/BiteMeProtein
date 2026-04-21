// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  CART_STORAGE_KEY,
  readStoredCart,
  writeStoredCart,
  clearStoredCart,
  type PersistedCart,
} from "./cart-storage";

const samplePersisted: PersistedCart = {
  bundles: [
    {
      tier: {
        id: "tier_1",
        name: "Half Dozen",
        item_count: 6,
        price_cents: 3000,
        shipping_eligible: true,
        pickup_only: false,
      },
      items: [
        {
          productId: "p1",
          variationId: "v1",
          name: "Chocolate Brownie",
          variationName: "Original",
          price: 500,
          quantity: 2,
        },
      ],
    },
  ],
  items: [],
};

describe("cart-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("writes then reads back the same payload", () => {
    writeStoredCart(samplePersisted);
    const restored = readStoredCart();
    expect(restored).toEqual(samplePersisted);
  });

  it("returns null when nothing has been stored", () => {
    expect(readStoredCart()).toBeNull();
  });

  it("returns null and does not throw on corrupted JSON", () => {
    window.localStorage.setItem(CART_STORAGE_KEY, "{not:valid:json");
    expect(readStoredCart()).toBeNull();
  });

  it("returns null when the stored payload is missing required arrays", () => {
    // Simulate an older schema where the cart was just a single bundle
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ bundle: "v1" }));
    expect(readStoredCart()).toBeNull();
  });

  it("clearStoredCart removes the stored payload", () => {
    writeStoredCart(samplePersisted);
    clearStoredCart();
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
    expect(readStoredCart()).toBeNull();
  });

  it("round-trips an empty cart", () => {
    const empty: PersistedCart = { bundles: [], items: [] };
    writeStoredCart(empty);
    expect(readStoredCart()).toEqual(empty);
  });
});
