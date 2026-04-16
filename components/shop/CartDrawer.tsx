"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/lib/cart";

// Shipping cost pulled from the bundle tier (cold pack shipping)

export default function CartDrawer() {
  const { bundles, removeBundle, removeItemFromBundle, items, removeItem, updateQuantity, isOpen, setIsOpen, clearCart, totalItems, totalPrice, hasShippableBundle } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderType, setOrderType] = useState<"pickup" | "shipping" | null>(null);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const isEmpty = bundles.length === 0 && items.length === 0;

  // Calculate shipping from the bundle tier's cold pack cost
  const shippingCost = bundles
    .filter((b) => b.tier.shipping_eligible)
    .reduce((s, b) => s + (b.tier.shipping_cost_cents || 1499), 0);

  // Smart upgrade detection
  // If total items across bundles >= 6, suggest 8-pack at $50
  // If total items across bundles = 6 and they're paying 2x $20, suggest 6-pack at $38
  const totalBundleItems = bundles.reduce((s, b) => s + b.items.reduce((si, i) => si + i.quantity, 0), 0);
  const bundleCost = bundles.reduce((s, b) => s + b.tier.price_cents, 0);

  let upgradeMessage = "";
  if (bundles.length >= 2) {
    if (totalBundleItems >= 7 && bundleCost > 5000) {
      upgradeMessage = `You're paying ${formatPrice(bundleCost)} for ${totalBundleItems} items. An 8-Pack is only $50 — save ${formatPrice(bundleCost - 5000)}!`;
    } else if (totalBundleItems >= 5 && bundleCost > 3800) {
      upgradeMessage = `You're paying ${formatPrice(bundleCost)} for ${totalBundleItems} items. A 6-Pack is only $38 — save ${formatPrice(bundleCost - 3800)}!`;
    }
  }
  const allBundlesFull = bundles.every((b) => b.items.reduce((s, i) => s + i.quantity, 0) >= b.tier.item_count);
  const canCheckout = !isEmpty && (bundles.length === 0 || allBundlesFull);

  const handleCheckout = async () => {
    if (!canCheckout) return;
    setCheckingOut(true);

    // Build line items from bundles + individual items
    const lineItems: { variationId: string; quantity: number }[] = [];
    bundles.forEach((b) => {
      b.items.forEach((item) => {
        lineItems.push({ variationId: item.variationId, quantity: item.quantity });
      });
    });
    items.forEach((item) => {
      lineItems.push({ variationId: item.variationId, quantity: item.quantity });
    });

    try {
      const res = await fetch("/api/square/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lineItems,
          orderType: orderType || "pickup",
          includeShipping: orderType === "shipping" && hasShippableBundle,
          shippingCostCents: shippingCost,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.checkoutUrl) { clearCart(); window.location.href = data.checkoutUrl; }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Checkout failed.");
      setCheckingOut(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" onClick={() => setIsOpen(false)} />

          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#f0e6de]">
              <h2 className="text-[#5a3e36] text-lg font-bold">Your Order ({totalItems})</h2>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-[#FFF5EE] flex items-center justify-center text-[#b0a098] hover:text-[#5a3e36]">✕</button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {isEmpty ? (
                <div className="text-center py-12">
                  <p className="text-2xl mb-2">📦</p>
                  <p className="font-bold text-[#5a3e36] mb-1">Your box is empty</p>
                  <p className="text-[#b0a098] text-sm">Pick a bundle to start building</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Bundles */}
                  {bundles.map((bundle, bi) => {
                    const count = bundle.items.reduce((s, i) => s + i.quantity, 0);
                    const isFull = count >= bundle.tier.item_count;
                    return (
                      <div key={bi} className={`rounded-xl border-2 p-4 ${isFull ? "border-green-300 bg-green-50/30" : "border-[#E8A0BF] bg-[#FCE4EC]/20"}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="text-[#5a3e36] font-bold text-sm">{bundle.tier.name}</h3>
                            <p className="text-[#b0a098] text-xs">
                              {count}/{bundle.tier.item_count} items • {formatPrice(bundle.tier.price_cents)}
                              {bundle.tier.shipping_eligible && <span className="text-green-600 ml-1">• Ships ✓</span>}
                            </p>
                          </div>
                          <button onClick={() => removeBundle(bi)} className="text-[#b0a098] hover:text-red-500 text-xs">Remove</button>
                        </div>

                        {!isFull && (
                          <div className="mb-3">
                            <div className="h-1.5 bg-[#f0e6de] rounded-full overflow-hidden">
                              <div className="h-full bg-[#E8A0BF] rounded-full transition-all" style={{ width: `${(count / bundle.tier.item_count) * 100}%` }} />
                            </div>
                            <p className="text-[#E8A0BF] text-xs font-semibold mt-1">Add {bundle.tier.item_count - count} more</p>
                          </div>
                        )}

                        {bundle.items.map((item) => (
                          <div key={item.variationId} className="flex items-center justify-between py-1.5 text-sm">
                            <span className="text-[#5a3e36]">{item.name} <span className="text-[#b0a098]">×{item.quantity}</span></span>
                            <button onClick={() => removeItemFromBundle(bi, item.variationId)} className="text-[#b0a098] hover:text-red-500 text-xs">−</button>
                          </div>
                        ))}

                        {isFull && <p className="text-green-600 text-xs font-bold mt-2">✓ Box complete!</p>}
                      </div>
                    );
                  })}

                  {/* Individual items */}
                  {items.length > 0 && (
                    <div>
                      <p className="text-[#7a6a62] text-xs font-bold uppercase tracking-wider mb-2">Individual Items</p>
                      {items.map((item) => (
                        <div key={item.variationId} className="bg-[#FFF5EE] rounded-lg p-3 mb-2 flex items-center justify-between">
                          <div>
                            <span className="text-[#5a3e36] text-sm font-medium">{item.name}</span>
                            <span className="text-[#b0a098] text-sm ml-2">×{item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQuantity(item.variationId, item.quantity - 1)} className="w-6 h-6 rounded-full bg-white border border-[#e8ddd4] text-xs flex items-center justify-center">−</button>
                            <button onClick={() => updateQuantity(item.variationId, item.quantity + 1)} className="w-6 h-6 rounded-full bg-white border border-[#e8ddd4] text-xs flex items-center justify-center">+</button>
                            <button onClick={() => removeItem(item.variationId)} className="text-[#b0a098] hover:text-red-500 text-xs ml-1">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Smart upgrade suggestion */}
                  {upgradeMessage && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-2">
                      <p className="text-green-700 text-xs font-semibold">💡 {upgradeMessage}</p>
                      <p className="text-green-600/60 text-[10px] mt-1">Go back to the shop and pick a bigger box to save.</p>
                    </div>
                  )}

                  <button onClick={clearCart} className="text-[#b0a098] hover:text-red-500 text-xs">Clear all</button>
                </div>
              )}
            </div>

            {/* Footer */}
            {!isEmpty && (
              <div className="p-5 border-t border-[#f0e6de]">
                {/* Order type picker */}
                {hasShippableBundle && (
                  <div className="flex gap-2 mb-4">
                    <button onClick={() => setOrderType("pickup")}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${orderType === "pickup" ? "bg-[#E8A0BF] text-white" : "bg-[#FFF5EE] text-[#7a6a62] border border-[#e8ddd4]"}`}>
                      🏪 Pickup
                    </button>
                    <button onClick={() => setOrderType("shipping")}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${orderType === "shipping" ? "bg-[#E8A0BF] text-white" : "bg-[#FFF5EE] text-[#7a6a62] border border-[#e8ddd4]"}`}>
                      📦 Shipping (+{formatPrice(shippingCost)})
                    </button>
                  </div>
                )}

                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#b0a098]">Subtotal</span>
                    <span className="text-[#5a3e36] font-semibold">{formatPrice(totalPrice)}</span>
                  </div>
                  {orderType === "shipping" && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#b0a098]">Shipping</span>
                      <span className="text-[#5a3e36] font-semibold">{formatPrice(shippingCost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-[#b0a098]">Tax</span>
                    <span className="text-[#b0a098] text-xs">At checkout</span>
                  </div>
                  <div className="h-px bg-[#f0e6de] my-1" />
                  <div className="flex justify-between">
                    <span className="text-[#5a3e36] font-bold">Total</span>
                    <span className="text-[#5a3e36] text-xl font-bold">
                      {formatPrice(totalPrice + (orderType === "shipping" ? shippingCost : 0))}
                    </span>
                  </div>
                </div>

                {!allBundlesFull && bundles.length > 0 && (
                  <p className="text-[#E8A0BF] text-xs font-semibold mb-3 text-center">
                    Fill all your boxes before checking out
                  </p>
                )}

                <button onClick={handleCheckout}
                  disabled={checkingOut || !canCheckout || (hasShippableBundle && !orderType)}
                  className="w-full bg-[#E8A0BF] text-white py-3.5 rounded-xl font-bold hover:bg-[#d889ad] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {checkingOut ? "Redirecting..." : !canCheckout ? "Fill your box first" : !orderType && hasShippableBundle ? "Choose pickup or shipping" : "Checkout"}
                </button>
                <p className="text-[#b0a098] text-xs text-center mt-2">Secure checkout powered by Square</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
