"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";

interface TrackedOrder {
  orderId: string;
  shortId: string;
  createdAt: string;
  state: string;
  total: { amount: number; currency: string } | null;
  items: { name: string; quantity: string; note: string | null }[];
  fulfillmentType: "SHIPMENT" | "PICKUP" | null;
  shipping: { city: string; state: string; zip: string } | null;
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
}

const statusSteps: { key: string; label: string; description: string; emoji: string }[] = [
  { key: "new", label: "Order received", description: "We've got it — baking soon", emoji: "📝" },
  { key: "preparing", label: "Being baked", description: "Fresh from the oven", emoji: "🔥" },
  { key: "shipped", label: "On the way", description: "Your treats are traveling", emoji: "📦" },
  { key: "delivered", label: "Delivered", description: "Enjoy!", emoji: "🎉" },
];

function carrierTrackingUrl(carrier: string | null, number: string): string {
  const n = encodeURIComponent(number);
  switch ((carrier || "").toLowerCase()) {
    case "fedex": return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case "ups": return `https://www.ups.com/track?tracknum=${n}`;
    case "usps": return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case "dhl": return `https://www.dhl.com/en/express/tracking.html?AWB=${n}`;
    default: return `https://www.google.com/search?q=${n}+tracking`;
  }
}

interface LoyaltyInfo {
  enabled: boolean;
  balance?: number;
  lifetimePoints?: number;
  terminology?: { one: string; other: string };
  rewardTiers?: Array<{ id: string; name: string; points: number }>;
}

function TrackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orderId, setOrderId] = useState(searchParams.get("id") || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyInfo | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const autoLookedUpRef = useRef(false);

  const handleLookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!orderId.trim() || !email.trim()) return;
    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const res = await fetch(
        `/api/orders/track?id=${encodeURIComponent(orderId.trim())}&email=${encodeURIComponent(email.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setOrder(data);
      // Update URL so customer can bookmark/share
      router.replace(`/track?id=${encodeURIComponent(orderId.trim())}&email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Auto-lookup when we have both id (from URL) and email (from URL or auth)
  // — saves signed-in customers from clicking through a form whose inputs
  // are already filled.
  useEffect(() => {
    if (autoLookedUpRef.current) return;
    if (!orderId.trim() || !email.trim()) return;
    if (order || loading) return;
    autoLookedUpRef.current = true;
    handleLookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, email]);

  const lookupLoyalty = async (phone: string) => {
    if (!phone.trim()) return;
    try {
      const res = await fetch(`/api/loyalty/balance?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      setLoyalty(data);
    } catch {
      /* silent */
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const statusIndex = statusSteps.findIndex((s) => s.key === order?.status);
  const inputClass = "w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-dark placeholder:text-dark/30 focus:outline-none focus:border-[#E8A0BF] focus:ring-2 focus:ring-[#E8A0BF]/20 transition-all";

  return (
    <div className="bg-cream min-h-screen py-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="stamp text-burgundy mb-4">Track Your Order</p>
          <h1 className="font-fun text-burgundy text-5xl md:text-6xl">
            Where&apos;s my <AnimatedSquiggly>order</AnimatedSquiggly>?
          </h1>
        </div>

        {/* Lookup form */}
        <ScrollReveal>
          <form onSubmit={handleLookup} className="card-bakery p-6 md:p-8 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dark/50 mb-1.5">
                  Order ID
                </label>
                <input
                  type="text"
                  placeholder="Last 6 chars, e.g. A7F2B9"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className={inputClass}
                  maxLength={40}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dark/50 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !orderId.trim() || !email.trim()}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? "Looking up…" : "Find my order"}
            </button>
            {error && (
              <p className="text-red-500 text-sm text-center mt-3">{error}</p>
            )}
          </form>
        </ScrollReveal>

        {/* Result */}
        {order && (
          <ScrollReveal>
            <div className="card-bakery p-6 md:p-8 space-y-6">
              {/* Order header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-[#f0e6de]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-dark/40">Order</p>
                  <h2 className="font-fun text-burgundy text-2xl">#{order.shortId}</h2>
                  <p className="text-dark/50 text-sm mt-1">Placed {formatDate(order.createdAt)}</p>
                </div>
                {order.total && (
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wider text-dark/40">Total</p>
                    <p className="font-fun text-burgundy text-2xl">{formatPrice(order.total.amount)}</p>
                  </div>
                )}
              </div>

              {/* Status timeline */}
              <div>
                <h3 className="font-bold text-dark mb-4 text-sm uppercase tracking-wider">Progress</h3>
                <ol className="relative border-l-2 border-[#f0e6de] ml-4 space-y-6">
                  {statusSteps.map((step, i) => {
                    const isDone = i <= statusIndex;
                    const isCurrent = i === statusIndex;
                    return (
                      <li key={step.key} className="ml-6">
                        <span className={`absolute -left-4 flex items-center justify-center w-8 h-8 rounded-full ring-4 ring-white text-sm ${
                          isDone ? "bg-[#E8A0BF] text-white" : "bg-[#FFF5EE] text-[#b0a098]"
                        }`}>
                          {isDone ? step.emoji : "•"}
                        </span>
                        <div>
                          <p className={`font-bold ${isDone ? "text-burgundy" : "text-dark/40"}`}>
                            {step.label}
                            {isCurrent && <span className="ml-2 text-xs bg-[#E8A0BF] text-white px-2 py-0.5 rounded-full">Now</span>}
                          </p>
                          <p className="text-dark/50 text-sm">{step.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Tracking */}
              {order.trackingNumber && (
                <div className="bg-[#FFF5EE] rounded-2xl p-5 border border-[#e8ddd4]">
                  <p className="text-xs font-bold uppercase tracking-wider text-dark/40 mb-2">
                    {order.carrier || "Tracking"} Tracking
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <code className="font-mono text-dark text-sm break-all">{order.trackingNumber}</code>
                    <a
                      href={carrierTrackingUrl(order.carrier, order.trackingNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center bg-[#E8A0BF] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#d889ad] shrink-0"
                    >
                      Track with {order.carrier || "Carrier"} →
                    </a>
                  </div>
                </div>
              )}

              {/* Ship-to summary (just city/state — not full address for privacy) */}
              {order.fulfillmentType === "SHIPMENT" && order.shipping && (
                <div className="text-sm text-dark/60">
                  <span className="font-bold uppercase tracking-wider text-xs text-dark/40 mr-2">Shipping to</span>
                  {order.shipping.city}, {order.shipping.state} {order.shipping.zip}
                </div>
              )}

              {order.fulfillmentType === "PICKUP" && (
                <div className="bg-golden-light/20 rounded-xl p-4 text-sm">
                  <p className="font-bold text-burgundy mb-1">🏪 Pickup order</p>
                  <p className="text-dark/60">953 E Oakland Park Blvd, Oakland Park, FL 33334</p>
                </div>
              )}

              {/* Items */}
              <div>
                <h3 className="font-bold text-dark mb-2 text-sm uppercase tracking-wider">Items</h3>
                <ul className="space-y-2">
                  {order.items.map((item, i) => (
                    <li key={i} className="flex justify-between text-sm bg-white rounded-lg p-3 border border-[#f0e6de]">
                      <div>
                        <span className="text-dark font-medium">{item.name}</span>
                        <span className="text-dark/50 ml-2">×{item.quantity}</span>
                        {item.note && (
                          <p className="text-dark/40 text-xs mt-0.5">{item.note}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Loyalty balance lookup */}
              <div className="bg-gradient-to-r from-salmon/10 to-golden/10 rounded-2xl p-5 border border-salmon/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">⭐</span>
                  <h3 className="font-bold text-burgundy text-sm uppercase tracking-wider">Rewards</h3>
                </div>
                {loyalty?.enabled ? (
                  <div>
                    <p className="text-dark/60 text-sm mb-2">
                      You have <span className="font-fun text-burgundy text-2xl">{loyalty.balance ?? 0}</span> {(loyalty.terminology?.other || "points").toLowerCase()}
                    </p>
                    {loyalty.rewardTiers && loyalty.rewardTiers.length > 0 && (
                      <div className="text-xs text-dark/50 space-y-1">
                        <p className="font-semibold uppercase tracking-wider mb-1">Available rewards:</p>
                        {loyalty.rewardTiers.map((t) => (
                          <p key={t.id} className={loyalty.balance !== undefined && loyalty.balance >= t.points ? "text-green-600 font-bold" : ""}>
                            {t.points} pts → {t.name}
                            {loyalty.balance !== undefined && loyalty.balance >= t.points && " ✓ unlocked"}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : loyalty?.enabled === false ? (
                  <p className="text-dark/40 text-xs">Loyalty program coming soon.</p>
                ) : (
                  <div>
                    <p className="text-dark/50 text-xs mb-2">Enter your phone to check your rewards balance:</p>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        placeholder="(555) 555-5555"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        className="flex-1 bg-white border border-[#e8ddd4] rounded-lg px-3 py-2 text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:border-[#E8A0BF]"
                      />
                      <button
                        onClick={() => lookupLoyalty(phoneInput)}
                        className="bg-burgundy text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-burgundy-dark"
                      >
                        Check
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Support CTA */}
              <div className="text-center pt-4 border-t border-[#f0e6de]">
                <p className="text-dark/50 text-sm">
                  Questions? <a href="mailto:haley@bitemeprotein.com" className="text-burgundy font-bold hover:underline">Email us</a> or call <a href="tel:9546044127" className="text-burgundy font-bold hover:underline">(954) 604-4127</a>
                </p>
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* Back to shop */}
        <div className="text-center mt-10">
          <Link href="/shop" className="text-burgundy/60 hover:text-burgundy text-sm font-semibold">
            ← Back to shop
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense>
      <TrackPageContent />
    </Suspense>
  );
}
