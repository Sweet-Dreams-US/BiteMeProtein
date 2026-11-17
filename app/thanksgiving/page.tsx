import type { Metadata } from "next";
import ScrollReveal from "@/components/animations/ScrollReveal";
import PreorderBuilder from "@/components/thanksgiving/PreorderBuilder";
import { THANKSGIVING_INFO } from "@/lib/thanksgiving";

export const metadata: Metadata = {
  title: "Thanksgiving Pre-Order | Bite Me Protein Bakery",
  description:
    "Pre-order Thanksgiving pies, tarts, keto and vegan treats, and build-your-own Gobble Boxes from Bite Me Protein Bakery. Pickup only.",
};

const LEAVES = [
  { emoji: "🍂", left: "6%", delay: "0s", size: "text-3xl" },
  { emoji: "🍁", left: "22%", delay: "3s", size: "text-2xl" },
  { emoji: "🍂", left: "41%", delay: "6s", size: "text-4xl" },
  { emoji: "🍁", left: "63%", delay: "1.5s", size: "text-3xl" },
  { emoji: "🍂", left: "80%", delay: "4.5s", size: "text-2xl" },
  { emoji: "🍁", left: "93%", delay: "7.5s", size: "text-3xl" },
];

const STEPS = [
  { n: "1", title: "Build your order", body: "Pick pies, bites, or a Gobble Box." },
  { n: "2", title: "Send your preorder", body: "Tell us who's picking up and when." },
  { n: "3", title: "We confirm", body: "We'll reach out to lock in your order." },
];

export default function ThanksgivingPage() {
  const { preorderDeadline, pickupWindows, holidayLabel } = THANKSGIVING_INFO;

  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-bitepink-pale via-bitepink-blush to-white pt-14 pb-16">
        <div className="dots-pink absolute inset-x-0 top-0" aria-hidden />
        {LEAVES.map((l, i) => (
          <span
            key={i}
            aria-hidden
            className={`absolute top-0 ${l.size} animate-leaf-fall pointer-events-none select-none`}
            style={{ left: l.left, animationDelay: l.delay }}
          >
            {l.emoji}
          </span>
        ))}
        <div className="absolute top-24 right-10 w-24 h-24 rounded-full bg-bitepink-light/40 animate-float" />
        <div className="absolute bottom-10 left-8 w-16 h-16 rounded-full bg-golden/40 animate-float-reverse" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="stamp text-bitepink-dark !border-bitepink mb-6">Thanksgiving Pre-Order</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="font-fun text-bitepink-dark text-5xl md:text-7xl leading-tight">
              Gobble, gobble.
              <br />
              <span className="text-dark">Dessert... but make it protein.</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-dark/70 max-w-2xl mx-auto mt-6">
              Pre-order pies, tarts and treats for {holidayLabel}. Build your own Gobble Box, pick your pie and size, and we&apos;ll have it ready for pickup.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <a href="#pies" className="inline-flex items-center justify-center rounded-full bg-bitepink hover:bg-bitepink-dark text-white font-bold px-8 py-3.5 shadow-lg transition-colors">
                Start my preorder
              </a>
              <a href="#bites" className="inline-flex items-center justify-center rounded-full border-2 border-bitepink text-bitepink-dark font-bold px-8 py-3.5 hover:bg-bitepink hover:text-white transition-colors">
                Build a Gobble Box 🦃
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== DEADLINE + PICKUP ===== */}
      <section className="bg-white pb-14">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ScrollReveal>
              <div className="h-full rounded-3xl border-4 border-dotted border-bitepink bg-bitepink-blush p-6 md:p-8 text-center">
                <p className="text-4xl mb-2" aria-hidden>⏰</p>
                <h2 className="font-fun text-bitepink-dark text-2xl mb-2">Preorder deadline</h2>
                {preorderDeadline ? (
                  <p className="text-dark font-bold text-xl">{preorderDeadline}</p>
                ) : (
                  <p className="text-dark/70">Deadline coming soon. Send your preorder early to get your spot.</p>
                )}
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <div className="h-full rounded-3xl border-4 border-dotted border-bitepink bg-bitepink-blush p-6 md:p-8 text-center">
                <p className="text-4xl mb-2" aria-hidden>🛍️</p>
                <h2 className="font-fun text-bitepink-dark text-2xl mb-2">Pickup details</h2>
                {pickupWindows.length > 0 ? (
                  <ul className="text-dark font-semibold space-y-1">
                    {pickupWindows.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-dark/70">Pickup days and times will be confirmed with your order.</p>
                )}
                <p className="text-dark/50 text-sm mt-2">Pickup only. Your pickup location comes with your confirmation email.</p>
              </div>
            </ScrollReveal>
          </div>

          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {STEPS.map((s, i) => (
              <ScrollReveal key={s.n} delay={i * 0.1}>
                <li className="flex items-start gap-3 text-left">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-bitepink text-white font-bold flex items-center justify-center">{s.n}</span>
                  <span>
                    <span className="block font-bold text-dark">{s.title}</span>
                    <span className="block text-sm text-dark/60">{s.body}</span>
                  </span>
                </li>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </section>

      <PreorderBuilder />
    </>
  );
}
