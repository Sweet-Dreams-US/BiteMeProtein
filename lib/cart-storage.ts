import type { CartBundle, CartItem } from "./cart-types";

// Schema version is baked into the key so a shape change (new required
// field on CartItem, etc.) invalidates stale saves cleanly instead of
// crashing rehydration in a customer's browser.
export const CART_STORAGE_KEY = "bmp_cart_v1";

export interface PersistedCart {
  bundles: CartBundle[];
  items: CartItem[];
}

export function readStoredCart(): PersistedCart | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCart;
    if (!Array.isArray(parsed.bundles) || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredCart(cart: PersistedCart): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Quota exceeded or storage disabled — silent failure is fine; the cart
    // still works in-memory for the current session.
  }
}

export function clearStoredCart(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
