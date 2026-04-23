"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { PaymentForm, CreditCard } from "react-square-web-payments-sdk";
import { useCart } from "@/lib/cart";
import Link from "next/link";
import PickupPicker, { PickupSelection } from "@/components/checkout/PickupPicker";

interface ShippingOption {
  service: string;
  priceCents: number;
}

const IDEMPOTENCY_STORAGE_KEY = "bmp_checkout_idempotency_v1";

// Generate (or reuse) a UUID scoped to this checkout attempt. The key
// survives page reloads via sessionStorage so a customer who double-clicks
// Pay or refreshes mid-payment cannot create two Square orders. Cleared on
// successful checkout (via clearCart → clears sessionStorage too).
function getOrCreateIdempotencyKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { bundles, items, totalPrice, hasShippableBundle, clearCart } = useCart();

  const isEmpty = bundles.length === 0 && items.length === 0;
  const allBundlesFull = bundles.every((b) => b.items.reduce((s, i) => s + i.quantity, 0) >= b.tier.item_count);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<"pickup" | "shipping">(hasShippableBundle ? "shipping" : "pickup");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  // Shipping options (fetched after zip is entered)
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  // Pickup slot selection
  const [pickupSelection, setPickupSelection] = useState<PickupSelection | null>(null);

  // Payment state
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  // Tracks successful payment so the "empty cart → /shop" redirect below
  // doesn't race against router.push("/order-confirmation") after clearCart.
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);

  // One stable idempotency key per checkout attempt. Ref so changes don't
  // trigger re-renders; initialized lazily in useEffect (browser-only).
  const idempotencyKey = useRef<string>("");
  useEffect(() => {
    idempotencyKey.current = getOrCreateIdempotencyKey();
  }, []);

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; savingsCents: number; summary: string; label: string } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);

  // Redirect if cart is empty — but NOT right after a successful payment,
  // because clearCart() empties the cart while router.push("/order-
  // confirmation") is still in flight. Without this guard, the post-
  // payment customer bounces to /shop and never sees the confirmation.
  useEffect(() => {
    if (isEmpty && !paymentSucceeded) router.replace("/shop");
  }, [isEmpty, paymentSucceeded, router]);

  // Fetch shipping rates when ZIP is complete and order type is shipping
  useEffect(() => {
    if (orderType !== "shipping" || zip.length < 5 || !hasShippableBundle) {
      setShippingOptions([]);
      setSelectedShipping(null);
      return;
    }
    let cancelled = false;
    setLoadingRates(true);
    setRateError(null);
    // Use Medium Box as the default box type for bakery bundles
    fetch(`/api/shipping/rates?zip=${encodeURIComponent(zip)}&boxType=Medium%20Box`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setRateError(data.error);
          setShippingOptions([]);
          return;
        }
        const opts: ShippingOption[] = data.options || [];
        setShippingOptions(opts);
        // Auto-select the cheapest (usually Express Saver or 2Day)
        if (opts.length > 0) setSelectedShipping(opts[0]);
      })
      .catch((err) => !cancelled && setRateError(err.message))
      .finally(() => !cancelled && setLoadingRates(false));
    return () => { cancelled = true; };
  }, [zip, orderType, hasShippableBundle]);

  const shippingCostCents = orderType === "shipping" && selectedShipping ? selectedShipping.priceCents : 0;
  const rushFeeCents = orderType === "pickup" ? (pickupSelection?.rushFeeCents ?? 0) : 0;
  const discountSavingsCents = appliedPromo?.savingsCents ?? 0;
  const grandTotal = Math.max(0, totalPrice + shippingCostCents + rushFeeCents - discountSavingsCents);

  // Re-validate applied promo whenever cart / orderType changes — keeps
  // UI honest if the customer toggles pickup/shipping after applying.
  useEffect(() => {
    if (!appliedPromo) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/discounts/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: appliedPromo.code,
            bundles: bundles.map((b) => ({
              tierName: b.tier.name,
              priceCents: b.tier.price_cents,
              items: b.items.map((i) => ({ variationId: i.variationId, name: i.name, quantity: i.quantity })),
            })),
            items: items.map((i) => ({ variationId: i.variationId, quantity: i.quantity })),
            orderType,
            customerEmail: email,
          }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (json.valid) {
          setAppliedPromo({
            code: appliedPromo.code,
            savingsCents: json.amountCentsSaved,
            summary: json.summary,
            label: json.codeLabel,
          });
          setPromoError("");
        } else {
          setAppliedPromo(null);
          setPromoError(json.reason ?? "Code no longer applies");
        }
      } catch { /* leave applied promo as-is on network errors */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderType, bundles.length, items.length]);

  const applyPromo = async () => {
    setPromoError("");
    setPromoValidating(true);
    try {
      const res = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: promoInput,
          bundles: bundles.map((b) => ({
            tierName: b.tier.name,
            priceCents: b.tier.price_cents,
            items: b.items.map((i) => ({ variationId: i.variationId, name: i.name, quantity: i.quantity })),
          })),
          items: items.map((i) => ({ variationId: i.variationId, quantity: i.quantity })),
          orderType,
          customerEmail: email,
        }),
      });
      const json = await res.json();
      if (json.valid) {
        setAppliedPromo({
          code: promoInput.trim(),
          savingsCents: json.amountCentsSaved,
          summary: json.summary,
          label: json.codeLabel,
        });
        setPromoInput("");
      } else {
        setPromoError(json.reason ?? "Couldn't apply that code");
      }
    } catch {
      setPromoError("Couldn't reach the server. Try again.");
    }
    setPromoValidating(false);
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoError("");
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const canSubmit = useMemo(() => {
    if (isEmpty || !allBundlesFull) return false;
    if (!firstName || !lastName || !email) return false;
    if (orderType === "shipping") {
      if (!address1 || !city || !state || zip.length < 5) return false;
      if (!selectedShipping) return false;
    }
    if (orderType === "pickup" && !pickupSelection) return false;
    return true;
  }, [isEmpty, allBundlesFull, firstName, lastName, email, orderType, address1, city, state, zip, selectedShipping, pickupSelection]);

  // Square credentials (public values)
  const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

  const handlePaymentToken = useCallback(async (token: { token?: string }, verifiedBuyer?: { token?: string }) => {
    if (!token?.token) {
      setPayError("Card tokenization failed");
      return;
    }
    setSubmitting(true);
    setPayError(null);

    try {
      const res = await fetch("/api/square/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: token.token,
          verificationToken: verifiedBuyer?.token,
          bundles: bundles.map((b) => ({
            tierName: b.tier.name,
            priceCents: b.tier.price_cents,
            items: b.items.map((i) => ({
              variationId: i.variationId,
              name: i.name,
              quantity: i.quantity,
            })),
          })),
          items: items.map((i) => ({
            variationId: i.variationId,
            quantity: i.quantity,
          })),
          buyerEmail: email,
          buyerPhone: phone,
          orderType,
          shippingAddress: orderType === "shipping" ? {
            addressLine1: address1,
            addressLine2: address2 || undefined,
            locality: city,
            administrativeDistrictLevel1: state,
            postalCode: zip,
            firstName,
            lastName,
          } : undefined,
          shippingService: selectedShipping?.service,
          shippingCostCents,
          promoCode: appliedPromo?.code,
          idempotencyKey: idempotencyKey.current || undefined,
          pickupAt: orderType === "pickup" ? pickupSelection?.pickupAt : undefined,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Success — clear the idempotency key so the customer's *next*
      // checkout attempt gets a fresh one, then clear cart + redirect.
      try { window.sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY); } catch { /* ignore */ }
      // Set BEFORE clearCart so the empty-cart effect sees this flag and
      // doesn't steal the navigation with router.replace("/shop").
      setPaymentSucceeded(true);
      clearCart();
      router.push(`/order-confirmation?order=${encodeURIComponent(data.orderId || "")}&email=${encodeURIComponent(email)}`);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment failed");
      setSubmitting(false);
    }
  }, [bundles, items, email, phone, orderType, address1, address2, city, state, zip, firstName, lastName, selectedShipping, shippingCostCents, appliedPromo?.code, pickupSelection, clearCart, router]);

  if (isEmpty) return null;

  if (!appId || !locationId) {
    return (
      <section className="min-h-screen flex items-center justify-center px-6 bg-cream">
        <div className="max-w-md text-center">
          <p className="text-burgundy font-bold mb-2">Checkout unavailable</p>
          <p className="text-dark/60 text-sm">Square credentials are not configured.</p>
        </div>
      </section>
    );
  }

  const inputClass = "w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-dark placeholder:text-dark/30 focus:outline-none focus:border-[#E8A0BF] focus:ring-2 focus:ring-[#E8A0BF]/20 transition-all";

  return (
    <section className="bg-cream min-h-screen py-12 overflow-x-hidden">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/shop" className="text-burgundy/60 hover:text-burgundy text-sm font-semibold">← Back to shop</Link>
          <h1 className="font-fun text-burgundy text-4xl md:text-5xl mt-3">Checkout</h1>
        </div>

        {/* min-w-0 on both grid children: CSS grid's `1fr` column has a
            min-width:auto default, which means nested grids/flex content
            (e.g. the slot grid's ~60 buttons) can push the column wider
            than its track and spill the whole layout past the container.
            Setting min-width: 0 forces the column to honor its track size
            so the 400px aside stays pinned at the right edge. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-8">
          {/* LEFT: Form */}
          <div className="space-y-6 min-w-0">
            {/* Contact */}
            <div className="card-bakery p-6 md:p-8">
              <h2 className="font-fun text-burgundy text-xl mb-4">Your info</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={inputClass} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <input className={inputClass} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                <input className={`${inputClass} sm:col-span-2`} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className={`${inputClass} sm:col-span-2`} type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            {/* Fulfillment */}
            {hasShippableBundle && (
              <div className="card-bakery p-6 md:p-8">
                <h2 className="font-fun text-burgundy text-xl mb-4">Delivery method</h2>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => setOrderType("pickup")}
                    className={`py-3 rounded-xl font-bold text-sm transition-colors ${orderType === "pickup" ? "bg-[#E8A0BF] text-white" : "bg-[#FFF5EE] text-[#7a6a62] border border-[#e8ddd4]"}`}
                  >
                    🏪 Pickup
                  </button>
                  <button
                    onClick={() => setOrderType("shipping")}
                    className={`py-3 rounded-xl font-bold text-sm transition-colors ${orderType === "shipping" ? "bg-[#E8A0BF] text-white" : "bg-[#FFF5EE] text-[#7a6a62] border border-[#e8ddd4]"}`}
                  >
                    📦 Shipping (FedEx)
                  </button>
                </div>

                {orderType === "shipping" && (
                  <div className="space-y-3">
                    <input className={inputClass} placeholder="Street address" value={address1} onChange={(e) => setAddress1(e.target.value)} />
                    <input className={inputClass} placeholder="Apt, suite, etc. (optional)" value={address2} onChange={(e) => setAddress2(e.target.value)} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <input className={`${inputClass} col-span-2 sm:col-span-1`} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                      <input className={inputClass} placeholder="State (FL)" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
                      <input className={inputClass} placeholder="ZIP" maxLength={10} value={zip} onChange={(e) => setZip(e.target.value)} />
                    </div>

                    {/* Shipping options */}
                    {zip.length >= 5 && (
                      <div className="pt-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-dark/50 mb-2">FedEx options</p>
                        {loadingRates ? (
                          <p className="text-dark/40 text-sm">Loading rates…</p>
                        ) : rateError ? (
                          <p className="text-red-500 text-sm">{rateError}</p>
                        ) : shippingOptions.length === 0 ? (
                          <p className="text-dark/40 text-sm">No shipping options available for this ZIP.</p>
                        ) : (
                          <div className="space-y-2">
                            {shippingOptions.map((opt) => (
                              <button
                                key={opt.service}
                                onClick={() => setSelectedShipping(opt)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors ${
                                  selectedShipping?.service === opt.service
                                    ? "bg-[#FFF0F5] border-[#E8A0BF]"
                                    : "bg-[#FFF9F4] border-[#e8ddd4] hover:border-[#E8A0BF]/50"
                                }`}
                              >
                                <span className="font-semibold text-dark text-sm">FedEx {opt.service}</span>
                                <span className="text-burgundy font-bold text-sm">{formatPrice(opt.priceCents)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Pickup time — shown whenever orderType === "pickup",
                including when cart has no shippable bundles */}
            {orderType === "pickup" && (
              <div className="card-bakery p-6 md:p-8">
                <h2 className="font-fun text-burgundy text-xl mb-4">Pickup time</h2>
                <p className="text-dark/50 text-xs mb-4">
                  Pick up at <strong>953 E Oakland Park Blvd, Oakland Park, FL 33334</strong>.
                  Orders are baked fresh — next-day is the default, same-day has a small rush fee if a slot&apos;s open.
                </p>
                <PickupPicker value={pickupSelection} onChange={setPickupSelection} />
              </div>
            )}

            {/* Promo code */}
            <div className="card-bakery p-6 md:p-8">
              <h2 className="font-fun text-burgundy text-xl mb-4">Promo code</h2>
              {appliedPromo ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-green-700 font-semibold text-sm">
                      ✓ <code className="font-mono">{appliedPromo.code}</code> applied
                    </p>
                    <p className="text-green-700 text-xs mt-1">{appliedPromo.label}</p>
                    <p className="text-green-700/70 text-xs mt-0.5">
                      {appliedPromo.summary} — save {formatPrice(appliedPromo.savingsCents)}
                    </p>
                  </div>
                  <button onClick={removePromo} className="text-xs text-green-700/60 hover:text-green-800 font-semibold shrink-0">
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Have a code?"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }}
                      className={`${inputClass} flex-1 uppercase`}
                      autoCapitalize="characters"
                      autoComplete="off"
                    />
                    <button
                      onClick={applyPromo}
                      disabled={!promoInput.trim() || promoValidating}
                      className="shrink-0 px-5 bg-burgundy text-white font-bold rounded-xl hover:bg-burgundy-dark disabled:opacity-50"
                    >
                      {promoValidating ? "…" : "Apply"}
                    </button>
                  </div>
                  {promoError && (
                    <p className="text-red-500 text-xs mt-2">{promoError}</p>
                  )}
                </>
              )}
            </div>

            {/* Card form */}
            <div className="card-bakery p-6 md:p-8">
              <h2 className="font-fun text-burgundy text-xl mb-4">Payment</h2>
              <div className="bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl p-4">
                <PaymentForm
                  applicationId={appId}
                  locationId={locationId}
                  cardTokenizeResponseReceived={async (token, verifiedBuyer) => {
                    const t = (token as { token?: string; status?: string }).token;
                    if (!t) {
                      setPayError("Card tokenization failed");
                      return;
                    }
                    await handlePaymentToken(
                      { token: t },
                      verifiedBuyer ? { token: (verifiedBuyer as { token?: string }).token } : undefined
                    );
                  }}
                  createVerificationDetails={() => ({
                    amount: (grandTotal / 100).toFixed(2),
                    currencyCode: "USD",
                    intent: "CHARGE",
                    billingContact: {
                      givenName: firstName,
                      familyName: lastName,
                      email,
                      phone,
                      country: "US",
                    },
                  })}
                >
                  <CreditCard
                    buttonProps={{
                      isLoading: submitting,
                      css: {
                        backgroundColor: canSubmit ? "#843430" : "#d4c4b8",
                        color: "white",
                        fontWeight: 700,
                        borderRadius: "9999px",
                        padding: "14px",
                        fontSize: "16px",
                        cursor: canSubmit ? "pointer" : "not-allowed",
                        "&:hover": {
                          backgroundColor: canSubmit ? "#6B2A27" : "#d4c4b8",
                        },
                      },
                    }}
                  >
                    {submitting ? "Processing…" : `Pay ${formatPrice(grandTotal)}`}
                  </CreditCard>
                </PaymentForm>
              </div>

              {payError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 mt-3">
                  {payError}
                </div>
              )}

              {!canSubmit && !submitting && (
                <p className="text-dark/40 text-xs text-center mt-3">
                  {!allBundlesFull
                    ? "Fill your boxes first"
                    : orderType === "pickup" && !pickupSelection
                    ? "Pick a pickup date + time"
                    : "Complete the form above"}
                </p>
              )}

              <p className="text-dark/40 text-xs text-center mt-3">
                🔒 Secured by Square. We never see your card number.
              </p>
            </div>
          </div>

          {/* RIGHT: Order summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start min-w-0">
            <div className="card-bakery p-6">
              <h2 className="font-fun text-burgundy text-xl mb-4">Your order</h2>

              <div className="space-y-3 mb-4">
                {bundles.map((b, i) => (
                  <div key={i} className="pb-3 border-b border-[#f0e6de] last:border-0">
                    <div className="flex justify-between font-semibold text-dark text-sm">
                      <span>{b.tier.name}</span>
                      <span>{formatPrice(b.tier.price_cents)}</span>
                    </div>
                    <ul className="text-dark/50 text-xs mt-1 space-y-0.5">
                      {b.items.map((item) => (
                        <li key={item.variationId}>• {item.name} ×{item.quantity}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                {items.map((item) => (
                  <div key={item.variationId} className="flex justify-between text-sm pb-3 border-b border-[#f0e6de] last:border-0">
                    <span className="text-dark">{item.name} ×{item.quantity}</span>
                    <span className="text-dark font-semibold">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark/50">Subtotal</span>
                  <span className="text-dark font-semibold">{formatPrice(totalPrice)}</span>
                </div>
                {orderType === "shipping" && selectedShipping && (
                  <div className="flex justify-between">
                    <span className="text-dark/50">Shipping (FedEx {selectedShipping.service})</span>
                    <span className="text-dark font-semibold">{formatPrice(shippingCostCents)}</span>
                  </div>
                )}
                {rushFeeCents > 0 && (
                  <div className="flex justify-between">
                    <span className="text-dark/50">Same-day rush</span>
                    <span className="text-dark font-semibold">{formatPrice(rushFeeCents)}</span>
                  </div>
                )}
                {appliedPromo && (
                  <div className="flex justify-between">
                    <span className="text-green-700">Promo ({appliedPromo.code})</span>
                    <span className="text-green-700 font-semibold">−{formatPrice(appliedPromo.savingsCents)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-dark/50">Tax</span>
                  <span className="text-dark/40 text-xs">Calculated by Square</span>
                </div>
                <div className="h-px bg-[#f0e6de] my-2" />
                <div className="flex justify-between text-base">
                  <span className="text-dark font-bold">Total</span>
                  <span className="text-dark font-bold">{formatPrice(grandTotal)}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
