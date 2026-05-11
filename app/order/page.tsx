"use client";

import { useState } from "react";
import Link from "next/link";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";

type OrderType = "standard" | "bear" | "cake" | "event";
type Fulfillment = "pickup" | "delivery";

interface StandardItem {
  name: string;
  variants?: string;
  checked: boolean;
  quantity: number;
}

interface BearItem {
  name: string;
  checked: boolean;
  quantity: number;
}

const initialStandardItems: StandardItem[] = [
  { name: "Raspberry Chocolate Chip Banana Bread", variants: "Bites / Mini Loaves", checked: false, quantity: 1 },
  { name: "Chocolate Chip Banana Bread", variants: "Bites / Mini Loaves", checked: false, quantity: 1 },
  { name: "Blueberry Muffins", checked: false, quantity: 1 },
  { name: "Brownies with Chocolate Chips", checked: false, quantity: 1 },
  { name: "Vegan Cookie Dough Balls", checked: false, quantity: 1 },
];

const initialBearItems: BearItem[] = [
  { name: "Blueberry Muffins (Bear Size)", checked: false, quantity: 1 },
  { name: "Chocolate Chip Banana Bread (Bear Size)", checked: false, quantity: 1 },
  { name: "Raspberry Chocolate Chip Banana Bread (Bear Size)", checked: false, quantity: 1 },
  { name: "Brownies (Bear Size)", checked: false, quantity: 1 },
];

const inputClass =
  "w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-dark placeholder:text-dark/30 focus:outline-none focus:border-[#E8A0BF] focus:ring-2 focus:ring-[#E8A0BF]/20 transition-all";

const radioClass =
  "w-5 h-5 accent-[#E8A0BF] cursor-pointer";

const checkboxClass =
  "w-5 h-5 accent-[#E8A0BF] rounded cursor-pointer";

export default function OrderPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("standard");
  const [standardItems, setStandardItems] = useState<StandardItem[]>(initialStandardItems);
  const [bearItems, setBearItems] = useState<BearItem[]>(initialBearItems);
  const [cakeFlavor, setCakeFlavor] = useState("");
  const [cakeSize, setCakeSize] = useState("");
  const [cakeInstructions, setCakeInstructions] = useState("");
  const [dateNeeded, setDateNeeded] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [fulfillment, setFulfillment] = useState<Fulfillment>("pickup");

  function toggleStandard(index: number) {
    setStandardItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item))
    );
  }

  function setStandardQty(index: number, qty: number) {
    setStandardItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: Math.max(1, qty) } : item))
    );
  }

  function toggleBear(index: number) {
    setBearItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item))
    );
  }

  function setBearQty(index: number, qty: number) {
    setBearItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: Math.max(1, qty) } : item))
    );
  }

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  /**
   * Build the structured details payload for /api/special-order. Each
   * order type packs only the fields relevant to it. The API handler
   * stores this as jsonb in special_orders.details, so we don't need a
   * column-per-field schema and adding a new field doesn't need a
   * migration — only a new key here and a new row in the admin email
   * template.
   */
  function buildDetails(): Record<string, unknown> {
    if (orderType === "standard") {
      return {
        items: standardItems
          .filter((i) => i.checked)
          .map((i) => ({ name: i.name, variants: i.variants ?? null, quantity: i.quantity })),
      };
    }
    if (orderType === "bear") {
      return {
        items: bearItems
          .filter((i) => i.checked)
          .map((i) => ({ name: i.name, quantity: i.quantity })),
      };
    }
    if (orderType === "cake") {
      return {
        flavor: cakeFlavor,
        size: cakeSize,
        instructions: cakeInstructions,
      };
    }
    // event / catering tiers — all custom, use the notes field below.
    return {};
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/special-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          orderType,
          details: buildDetails(),
          dateNeeded: dateNeeded || undefined,
          fulfillment,
          notes: specialInstructions || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't submit your request.");
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't submit your request. Please try again.");
    }
    setSubmitting(false);
  }

  return (
    <>
      {/* ===== HERO ===== */}
      <section className="pt-16 pb-10 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-14 right-16 w-24 h-24 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-8 left-10 w-16 h-16 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="absolute top-1/3 right-1/4 w-10 h-10 rounded-full bg-burgundy/10 animate-float" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-6">Special Orders</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="font-fun text-burgundy text-5xl md:text-7xl max-w-3xl mx-auto">
              Custom <AnimatedSquiggly>orders.</AnimatedSquiggly>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-gray max-w-2xl mx-auto mt-6">
              Birthday cakes, bear size treats, event catering, or bulk orders — tell us what you need and we&apos;ll make it happen.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== FORM ===== */}
      <section className="py-16 bg-cream">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <form onSubmit={handleSubmit} className="card-bakery p-8 md:p-12 space-y-10">
              {/* ----- Customer Info ----- */}
              <div>
                <h2 className="font-fun text-burgundy text-2xl mb-6">Your Info</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-dark mb-1.5">Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-dark mb-1.5">Phone *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-dark mb-1.5">Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* ----- Order Type ----- */}
              <div>
                <h2 className="font-fun text-burgundy text-2xl mb-6">Order Type</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      ["standard", "Standard Items"],
                      ["bear", "Bear Size Treats"],
                      ["cake", "Birthday Cake"],
                      ["event", "Event / Bulk Order"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        orderType === value
                          ? "bg-[#FFF0F5] border-[#E8A0BF] shadow-sm"
                          : "bg-[#FFF9F4] border-[#e8ddd4] hover:border-[#E8A0BF]/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="orderType"
                        value={value}
                        checked={orderType === value}
                        onChange={() => setOrderType(value)}
                        className={radioClass}
                      />
                      <span className="text-dark font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* ----- Standard Items ----- */}
              {orderType === "standard" && (
                <div className="space-y-3">
                  <h3 className="font-fun text-burgundy text-xl mb-2">Select Items</h3>
                  {standardItems.map((item, i) => (
                    <div
                      key={item.name}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        item.checked
                          ? "bg-[#FFF0F5] border-[#E8A0BF]"
                          : "bg-[#FFF9F4] border-[#e8ddd4]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleStandard(i)}
                        className={checkboxClass}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-dark font-medium text-sm">{item.name}</p>
                        {item.variants && (
                          <p className="text-dark/40 text-xs">{item.variants}</p>
                        )}
                      </div>
                      {item.checked && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setStandardQty(i, item.quantity - 1)}
                            className="w-8 h-8 rounded-lg bg-burgundy/10 text-burgundy font-bold flex items-center justify-center hover:bg-burgundy/20 transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-dark">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => setStandardQty(i, item.quantity + 1)}
                            className="w-8 h-8 rounded-lg bg-burgundy/10 text-burgundy font-bold flex items-center justify-center hover:bg-burgundy/20 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ----- Bear Size Items ----- */}
              {orderType === "bear" && (
                <div className="space-y-3">
                  <h3 className="font-fun text-burgundy text-xl mb-2">Bear Size Items</h3>
                  <p className="text-dark/50 text-sm mb-4">Our oversized treats — perfect for sharing or serious snacking.</p>
                  {bearItems.map((item, i) => (
                    <div
                      key={item.name}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        item.checked
                          ? "bg-[#FFF0F5] border-[#E8A0BF]"
                          : "bg-[#FFF9F4] border-[#e8ddd4]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleBear(i)}
                        className={checkboxClass}
                      />
                      <p className="flex-1 text-dark font-medium text-sm">{item.name}</p>
                      {item.checked && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setBearQty(i, item.quantity - 1)}
                            className="w-8 h-8 rounded-lg bg-burgundy/10 text-burgundy font-bold flex items-center justify-center hover:bg-burgundy/20 transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-dark">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => setBearQty(i, item.quantity + 1)}
                            className="w-8 h-8 rounded-lg bg-burgundy/10 text-burgundy font-bold flex items-center justify-center hover:bg-burgundy/20 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ----- Birthday Cake ----- */}
              {orderType === "cake" && (
                <div className="space-y-4">
                  <h3 className="font-fun text-burgundy text-xl mb-2">Birthday Cake Details</h3>
                  <div>
                    <label className="block text-sm font-semibold text-dark mb-1.5">Flavor Choice</label>
                    <input
                      type="text"
                      value={cakeFlavor}
                      onChange={(e) => setCakeFlavor(e.target.value)}
                      placeholder="e.g. Chocolate, Vanilla, Red Velvet..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-dark mb-1.5">Size / Servings</label>
                    <input
                      type="text"
                      value={cakeSize}
                      onChange={(e) => setCakeSize(e.target.value)}
                      placeholder="e.g. 10-inch round, serves 12"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-dark mb-1.5">Special Instructions</label>
                    <textarea
                      value={cakeInstructions}
                      onChange={(e) => setCakeInstructions(e.target.value)}
                      rows={3}
                      placeholder="Decoration, inscription, dietary notes..."
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {/* ----- Event / Bulk (just the general fields below) ----- */}
              {orderType === "event" && (
                <div className="p-6 rounded-xl bg-[#FFF0F5] border border-[#E8A0BF]/30">
                  <p className="text-dark font-medium mb-1">Event &amp; Bulk Orders</p>
                  <p className="text-dark/50 text-sm">
                    Tell us about your event in the Special Instructions below — how many guests, what items you&apos;re interested in, and any dietary requirements. We&apos;ll get back to you with a custom quote.
                  </p>
                </div>
              )}

              {/* ----- Date & Fulfillment ----- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-dark mb-1.5">Date Needed *</label>
                  <input
                    type="date"
                    required
                    value={dateNeeded}
                    onChange={(e) => setDateNeeded(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark mb-3">Fulfillment</label>
                  <div className="flex gap-3">
                    {(["pickup", "delivery"] as const).map((opt) => (
                      <label
                        key={opt}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-center ${
                          fulfillment === opt
                            ? "bg-[#FFF0F5] border-[#E8A0BF] shadow-sm"
                            : "bg-[#FFF9F4] border-[#e8ddd4] hover:border-[#E8A0BF]/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="fulfillment"
                          value={opt}
                          checked={fulfillment === opt}
                          onChange={() => setFulfillment(opt)}
                          className={radioClass}
                        />
                        <span className="text-dark font-medium capitalize">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* ----- Special Instructions ----- */}
              <div>
                <label className="block text-sm font-semibold text-dark mb-1.5">Special Instructions</label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={4}
                  placeholder="Anything else we should know — allergies, preferences, event details..."
                  className={inputClass}
                />
              </div>

              {/* ----- Submit ----- */}
              <div className="pt-4">
                {submitted ? (
                  <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 text-center">
                    <p className="text-green-700 font-bold text-lg mb-1">Request received! 🎉</p>
                    <p className="text-green-600 text-sm">
                      We&apos;ll get back to you at <strong>{email}</strong> within 24 hours.
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary w-full text-center text-lg py-4 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitting ? "Sending..." : "Send Order Request"}
                    </button>
                    {submitError && (
                      <p className="text-red-600 text-sm text-center mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                        {submitError} If this keeps happening, call us at <a className="font-bold underline" href="tel:+19546044127">(954) 604-4127</a>.
                      </p>
                    )}
                    <p className="text-dark/40 text-xs text-center mt-3">
                      We&apos;ll respond within 24 hours at the email you provided.
                    </p>
                  </>
                )}
              </div>
            </form>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-16 bg-burgundy relative overflow-hidden">
        <div className="absolute top-6 right-12 w-14 h-14 rounded-full bg-white/10 animate-float" />
        <div className="absolute bottom-6 left-14 w-10 h-10 rounded-full bg-salmon/20 animate-float-reverse" />

        <div className="relative max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="font-fun text-white text-3xl mb-3">Want to order from our regular menu?</h2>
            <p className="text-white/60 mb-6">Browse our full lineup and build a box.</p>
            <Link
              href="/shop"
              className="inline-flex items-center justify-center bg-white text-burgundy px-8 py-4 rounded-full text-base font-bold hover:bg-cream transition-all hover:scale-105 shadow-lg"
            >
              Shop Now
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
