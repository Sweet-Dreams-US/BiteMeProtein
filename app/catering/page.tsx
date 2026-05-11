"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";
import { images } from "@/lib/images";

/**
 * /catering — three-tier catering page.
 *
 * The tiers live in this file as a small constants array so Cole can
 * edit pricing or party size without me having to make a code change.
 * Anything ABOVE the largest tier is intentionally NOT a 4th tier;
 * those orders are too custom for a fixed package and route to /order
 * (Special Orders) where the customer can describe what they need.
 *
 * Each tier's "Request" button scrolls to one shared form on the page
 * and pre-selects the tier — keeping the form footprint to a single
 * UI block keeps the page short and the submission flow predictable.
 *
 * The form POSTs to /api/special-order which:
 *   1. Inserts a special_orders row (durable record)
 *   2. Fires a branded admin email via Resend
 * Same path as /order, just with a catering-tier orderType.
 */

type Tier = "catering-small" | "catering-medium" | "catering-large";

interface TierDef {
  id: Tier;
  label: string;
  emoji: string;
  serves: string;
  startingAt: string;
  bestFor: string;
  includes: string[];
  highlight?: boolean;
}

const TIERS: TierDef[] = [
  {
    id: "catering-small",
    label: "Small",
    emoji: "🎁",
    serves: "10–15 people",
    startingAt: "Starting at $75",
    bestFor: "Small office breakfasts, family events, gym staff treats",
    includes: [
      "Assorted protein treats (mix of muffins, brownies, banana bread bites)",
      "Two flavor varieties",
      "Custom packaging",
    ],
  },
  {
    id: "catering-medium",
    label: "Medium",
    emoji: "📦",
    serves: "25–35 people",
    startingAt: "Starting at $160",
    bestFor: "Team meetings, fitness studio events, baby showers",
    includes: [
      "Wider assortment — muffins, brownies, banana bread bites, truffles",
      "Three flavor varieties",
      "Display-ready packaging",
      "Includes a few bear-size treats for sharing",
    ],
    highlight: true,
  },
  {
    id: "catering-large",
    label: "Large",
    emoji: "🍰",
    serves: "50+ people",
    startingAt: "Starting at $295",
    bestFor: "Conferences, large events, corporate parties, gym openings",
    includes: [
      "Full spread — every product line",
      "All four flavor varieties",
      "Premium display setup",
      "Multiple bear-size centerpieces",
      "Setup + delivery available",
    ],
  },
];

const inputClass =
  "w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-dark placeholder:text-dark/30 focus:outline-none focus:border-[#E8A0BF] focus:ring-2 focus:ring-[#E8A0BF]/20 transition-all";
const labelClass = "block text-sm font-semibold text-dark mb-1.5";

export default function CateringPage() {
  const [selectedTier, setSelectedTier] = useState<Tier>("catering-medium");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [eventType, setEventType] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  /**
   * Click handler for the tier cards. Selects the tier AND scrolls to
   * the request form so the customer doesn't have to hunt for it.
   * Soft scroll, behavior:"smooth" so it doesn't feel jarring.
   */
  const selectTierAndScroll = (tier: Tier) => {
    setSelectedTier(tier);
    setSubmitted(false);
    setSubmitError(null);
    document
      .getElementById("catering-request")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const tierDef = TIERS.find((t) => t.id === selectedTier)!;
      const res = await fetch("/api/special-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          orderType: selectedTier,
          details: {
            tier: tierDef.label,
            serves: tierDef.serves,
            startingAt: tierDef.startingAt,
            estimatedHeadcount: headcount || null,
            eventType: eventType || null,
          },
          dateNeeded: eventDate || undefined,
          fulfillment: "delivery", // catering defaults to delivery — admin can change
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't submit your request.");
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't submit your request.");
    }
    setSubmitting(false);
  }

  return (
    <>
      {/* ===== HERO ===== */}
      <section className="pt-16 pb-10 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-14 right-16 w-24 h-24 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-8 left-10 w-16 h-16 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-6">Catering</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="font-fun text-burgundy text-5xl md:text-7xl max-w-3xl mx-auto">
              Feed the whole <AnimatedSquiggly>crew.</AnimatedSquiggly>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-gray max-w-2xl mx-auto mt-6">
              Three catering packages for offices, events, fitness studios, and gatherings of every size.
              Every treat baked fresh, packaged ready to serve.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== TIER CARDS ===== */}
      <section className="py-16 bg-cream">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIERS.map((tier, i) => (
              <ScrollReveal key={tier.id} delay={i * 0.1}>
                <div
                  className={`card-bakery p-8 h-full flex flex-col transition-all ${
                    selectedTier === tier.id
                      ? "ring-2 ring-[#E8A0BF] shadow-lg"
                      : "hover:shadow-md"
                  } ${tier.highlight ? "border-2 border-[#E8A0BF]/40" : ""}`}
                >
                  {tier.highlight && (
                    <span className="self-start mb-3 bg-[#E8A0BF] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Most Popular
                    </span>
                  )}
                  <div className="text-4xl mb-3">{tier.emoji}</div>
                  <h2 className="font-fun text-burgundy text-3xl mb-1">{tier.label}</h2>
                  <p className="text-burgundy/60 text-sm font-bold mb-4">{tier.serves}</p>
                  <p className="text-dark text-2xl font-bold mb-2">{tier.startingAt}</p>
                  <p className="text-dark/50 text-sm mb-4 italic">{tier.bestFor}</p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {tier.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-dark/70 text-sm">
                        <span className="text-[#E8A0BF] font-bold shrink-0">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => selectTierAndScroll(tier.id)}
                    className={
                      selectedTier === tier.id
                        ? "btn-primary w-full text-center"
                        : "btn-secondary w-full text-center"
                    }
                  >
                    {selectedTier === tier.id ? "Selected ✓" : `Request ${tier.label}`}
                  </button>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* ===== ABOVE LARGE → SPECIAL ORDER ===== */}
          <ScrollReveal delay={0.4}>
            <div className="mt-8 card-bakery p-8 bg-gradient-warm flex flex-col md:flex-row items-center gap-6">
              <div className="text-5xl">🎉</div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-fun text-burgundy text-2xl mb-1">
                  Need something bigger?
                </h3>
                <p className="text-dark/60 text-sm">
                  Over 50 people, multiple locations, or fully-custom menus — these go through our Special Orders flow so we can quote it properly.
                </p>
              </div>
              <Link href="/order" className="btn-primary shrink-0">
                Place a Special Order →
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== REQUEST FORM ===== */}
      <section id="catering-request" className="py-16 bg-white scroll-mt-24">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-8">
              <p className="stamp text-burgundy mb-4">Get a Quote</p>
              <h2 className="font-fun text-burgundy text-3xl md:text-4xl">
                Request your <AnimatedSquiggly>{TIERS.find((t) => t.id === selectedTier)?.label}</AnimatedSquiggly> package
              </h2>
              <p className="text-dark/50 mt-4">
                We&apos;ll get back to you with a custom quote within 24 hours.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <form onSubmit={handleSubmit} className="card-bakery p-8 space-y-6">
              {/* Tier selection (mirror of the cards, so customers can switch mid-form) */}
              <div>
                <label className={labelClass}>Package Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIERS.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedTier(tier.id)}
                      className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                        selectedTier === tier.id
                          ? "bg-[#FFF0F5] border-[#E8A0BF] text-burgundy"
                          : "bg-[#FFF9F4] border-[#e8ddd4] text-dark/70 hover:border-[#E8A0BF]/50"
                      }`}
                    >
                      {tier.emoji} {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Your Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@email.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Event Date *</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Estimated Headcount</label>
                  <input
                    type="number"
                    min={1}
                    value={headcount}
                    onChange={(e) => setHeadcount(e.target.value)}
                    className={inputClass}
                    placeholder="20"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Event Type</label>
                <input
                  type="text"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className={inputClass}
                  placeholder="Office meeting, gym opening, birthday party..."
                />
              </div>

              <div>
                <label className={labelClass}>Anything we should know?</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className={inputClass}
                  placeholder="Dietary needs, flavor preferences, location, setup details..."
                />
              </div>

              {/* Submit / success / error */}
              {submitted ? (
                <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 text-center">
                  <p className="text-green-700 font-bold text-lg mb-1">
                    Catering request received! 🎉
                  </p>
                  <p className="text-green-600 text-sm">
                    We&apos;ll send you a quote at <strong>{email}</strong> within 24 hours.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full text-center text-lg py-4 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Sending..." : "Request Quote"}
                  </button>
                  {submitError && (
                    <p className="text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-lg p-3">
                      {submitError} If this keeps happening, call us at{" "}
                      <a className="font-bold underline" href="tel:+19546044127">
                        (954) 604-4127
                      </a>
                      .
                    </p>
                  )}
                </>
              )}
            </form>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== TRUST SECTION ===== */}
      <section className="py-16 bg-cream">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <ScrollReveal className="aspect-square rounded-2xl overflow-hidden relative shadow-md">
                <Image
                  src={images.hero.allBitesWide}
                  alt="Catering spread"
                  fill
                  className="object-cover"
                />
              </ScrollReveal>
              <ScrollReveal
                delay={0.1}
                className="aspect-square rounded-2xl overflow-hidden relative shadow-md"
              >
                <Image
                  src={images.lifestyle.chocChipHeartBrownies}
                  alt="Heart brownies"
                  fill
                  className="object-cover"
                />
              </ScrollReveal>
              <ScrollReveal
                delay={0.2}
                className="aspect-square rounded-2xl overflow-hidden relative shadow-md"
              >
                <Image
                  src={images.hero.teddyBearBitesWide}
                  alt="Teddy bear bites"
                  fill
                  className="object-cover"
                />
              </ScrollReveal>
              <ScrollReveal
                delay={0.3}
                className="aspect-square rounded-2xl overflow-hidden relative shadow-md"
              >
                <Image
                  src={images.lifestyle.chocTrufflesRed}
                  alt="Truffles"
                  fill
                  className="object-cover"
                />
              </ScrollReveal>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-16 bg-burgundy relative overflow-hidden">
        <div className="absolute top-6 right-12 w-14 h-14 rounded-full bg-white/10 animate-float" />
        <div className="absolute bottom-6 left-14 w-10 h-10 rounded-full bg-salmon/20 animate-float-reverse" />
        <div className="relative max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="font-fun text-white text-3xl mb-3">
              Questions? Reach out.
            </h2>
            <p className="text-white/60 mb-6">
              Call (954) 604-4127 or email haley@bitemeprotein.com — we&apos;ll talk through your event.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="tel:+19546044127"
                className="inline-flex items-center justify-center bg-white text-burgundy px-8 py-4 rounded-full text-base font-bold hover:bg-cream transition-all hover:scale-105 shadow-lg"
              >
                📞 Call us
              </a>
              <a
                href="mailto:haley@bitemeprotein.com"
                className="inline-flex items-center justify-center bg-white/10 text-white border-2 border-white/30 px-8 py-4 rounded-full text-base font-bold hover:bg-white/20 transition-all"
              >
                ✉️ Email Haley
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
