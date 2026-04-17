"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface CartItem {
  productId: string;
  variationId: string;
  name: string;
  variationName: string;
  price: number; // in cents (individual price)
  quantity: number;
  image?: string;
}

export interface BundleTier {
  id: string;
  name: string;
  item_count: number;
  price_cents: number;
  shipping_eligible: boolean;
  pickup_only: boolean;
  shipping_cost_cents?: number;
}

export interface CartBundle {
  tier: BundleTier;
  items: CartItem[]; // items selected for this bundle
}

interface CartContextType {
  // Bundle mode
  bundles: CartBundle[];
  addBundle: (tier: BundleTier) => void;
  addBundleWithItems: (tier: BundleTier, items: CartItem[]) => void;
  removeBundle: (index: number) => void;
  addItemToBundle: (bundleIndex: number, item: Omit<CartItem, "quantity">) => void;
  removeItemFromBundle: (bundleIndex: number, variationId: string) => void;
  getBundleItemCount: (bundleIndex: number) => number;
  isBundleFull: (bundleIndex: number) => boolean;

  // Individual items (pickup only)
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (variationId: string) => void;
  updateQuantity: (variationId: string, quantity: number) => void;

  // Shared
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  clearCart: () => void;
  clearIndividualItems: () => void;
  totalItems: number;
  totalPrice: number; // in cents
  hasShippableBundle: boolean;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [bundles, setBundles] = useState<CartBundle[]>([]);
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Bundle operations
  const addBundle = useCallback((tier: BundleTier) => {
    setBundles((prev) => [...prev, { tier, items: [] }]);
    setIsOpen(true);
  }, []);

  // Create a bundle pre-filled with items (truncated to capacity)
  const addBundleWithItems = useCallback((tier: BundleTier, items: CartItem[]) => {
    // Truncate to bundle capacity
    let remaining = tier.item_count;
    const trimmed: CartItem[] = [];
    for (const item of items) {
      if (remaining <= 0) break;
      const qty = Math.min(item.quantity, remaining);
      trimmed.push({ ...item, quantity: qty });
      remaining -= qty;
    }
    setBundles((prev) => [...prev, { tier, items: trimmed }]);
  }, []);

  const removeBundle = useCallback((index: number) => {
    setBundles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addItemToBundle = useCallback((bundleIndex: number, item: Omit<CartItem, "quantity">) => {
    setBundles((prev) => {
      const updated = [...prev];
      const bundle = updated[bundleIndex];
      if (!bundle) return prev;

      const totalInBundle = bundle.items.reduce((sum, i) => sum + i.quantity, 0);
      if (totalInBundle >= bundle.tier.item_count) return prev; // bundle is full

      const existing = bundle.items.find((i) => i.variationId === item.variationId);
      if (existing) {
        bundle.items = bundle.items.map((i) =>
          i.variationId === item.variationId ? { ...i, quantity: i.quantity + 1 } : i
        );
      } else {
        bundle.items = [...bundle.items, { ...item, quantity: 1 }];
      }
      return updated;
    });
  }, []);

  const removeItemFromBundle = useCallback((bundleIndex: number, variationId: string) => {
    setBundles((prev) => {
      const updated = [...prev];
      const bundle = updated[bundleIndex];
      if (!bundle) return prev;

      const item = bundle.items.find((i) => i.variationId === variationId);
      if (item && item.quantity > 1) {
        bundle.items = bundle.items.map((i) =>
          i.variationId === variationId ? { ...i, quantity: i.quantity - 1 } : i
        );
      } else {
        bundle.items = bundle.items.filter((i) => i.variationId !== variationId);
      }
      return updated;
    });
  }, []);

  const getBundleItemCount = useCallback((bundleIndex: number) => {
    const bundle = bundles[bundleIndex];
    return bundle ? bundle.items.reduce((sum, i) => sum + i.quantity, 0) : 0;
  }, [bundles]);

  const isBundleFull = useCallback((bundleIndex: number) => {
    const bundle = bundles[bundleIndex];
    if (!bundle) return false;
    return bundle.items.reduce((sum, i) => sum + i.quantity, 0) >= bundle.tier.item_count;
  }, [bundles]);

  // Individual item operations
  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variationId === item.variationId);
      if (existing) return prev.map((i) => i.variationId === item.variationId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((variationId: string) => {
    setItems((prev) => prev.filter((i) => i.variationId !== variationId));
  }, []);

  const updateQuantity = useCallback((variationId: string, quantity: number) => {
    if (quantity <= 0) { setItems((prev) => prev.filter((i) => i.variationId !== variationId)); return; }
    setItems((prev) => prev.map((i) => (i.variationId === variationId ? { ...i, quantity } : i)));
  }, []);

  const clearCart = useCallback(() => {
    setBundles([]);
    setItems([]);
  }, []);

  const clearIndividualItems = useCallback(() => {
    setItems([]);
  }, []);

  const bundleTotal = bundles.reduce((sum, b) => sum + b.tier.price_cents, 0);
  const itemTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalPrice = bundleTotal + itemTotal;
  const totalItems = bundles.reduce((sum, b) => sum + b.items.reduce((s, i) => s + i.quantity, 0), 0) + items.reduce((sum, i) => sum + i.quantity, 0);
  const hasShippableBundle = bundles.some((b) => b.tier.shipping_eligible);

  return (
    <CartContext.Provider value={{
      bundles, addBundle, addBundleWithItems, removeBundle, addItemToBundle, removeItemFromBundle, getBundleItemCount, isBundleFull,
      items, addItem, removeItem, updateQuantity,
      isOpen, setIsOpen, clearCart, clearIndividualItems, totalItems, totalPrice, hasShippableBundle,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
