"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";

const badIngredients = [
  { emoji: "🧪", text: "Artificial sweeteners you can't pronounce" },
  { emoji: "❓", text: "Mystery protein powders & fillers" },
  { emoji: "🧱", text: "Chalky, cardboard-like texture" },
  { emoji: "📦", text: "Sits on a shelf for 18 months" },
];

const goodIngredients = [
  { emoji: "🍓", text: "Real ingredients your grandma would recognize" },
  { emoji: "🔥", text: "Fresh-baked in small batches" },
  { emoji: "😋", text: "Actually tastes like a dessert" },
  { emoji: "📬", text: "Made to order, shipped to your door" },
];

const stats = [
  {
    name: "Protein",
    biteMe: "18g",
    competitor: "10g",
    line: "Almost 2x the protein. No contest.",
  },
  {
    name: "Sugar",
    biteMe: "4g",
    competitor: "22g",
    line: "Less sugar than your morning coffee.",
  },
  {
    name: "Artificial Ingredients",
    biteMe: "0",
    competitor: "12+",
    line: "Zero. Zilch. Nada.",
  },
  {
    name: "Taste Score",
    biteMe: "95%",
    competitor: "40%",
    line: "People actually finish ours.",
  },
  {
    name: "Freshness",
    biteMe: "98%",
    competitor: "15%",
    line: "Baked this week, not last year.",
  },
  {
    name: "Calories",
    biteMe: "180",
    competitor: "250",
    line: "Fewer calories, way more flavor.",
  },
];

const testimonials = [
  {
    quote:
      "I used to choke down chalky bars after the gym. Now I literally look forward to my post-workout snack.",
    name: "Jess M.",
    detail: "Switched from Quest Bars",
  },
  {
    quote:
      "My kids steal my protein brownies. That has literally never happened with a protein bar.",
    name: "David R.",
    detail: "Switched from RXBARs",
  },
  {
    quote:
      "I thought 'healthy dessert' was an oxymoron until I tried Bite Me. Now I'm a monthly subscriber.",
    name: "Priya K.",
    detail: "Switched from Built Bars",
  },
];

export default function ComparePage() {
  return (
    <div className="bg-warm-bg min-h-screen">
      {/* Header */}
      <section className="pt-24 pb-16 relative overflow-hidden">
        {/* Floating decorative circles */}
        <div className="absolute top-12 left-[10%] w-24 h-24 rounded-full bg-salmon/10 animate-float" />
        <div className="absolute top-32 right-[8%] w-16 h-16 rounded-full bg-golden-light/20 animate-float-reverse" />
        <div className="absolute bottom-8 left-[25%] w-12 h-12 rounded-full bg-burgundy/10 animate-bounce-gentle" />
        <div className="absolute bottom-16 right-[20%] w-20 h-20 rounded-full bg-salmon-light/15 animate-float" />

        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative z-10">
          <ScrollReveal>
            <span className="stamp inline-block bg-salmon text-white text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
              The Breakdown
            </span>
            <h1 className="font-fun text-5xl md:text-6xl lg:text-7xl text-burgundy leading-tight">
              Your{" "}
              <AnimatedSquiggly color="#8B2252">protein bar</AnimatedSquiggly>{" "}
              could never.
            </h1>
            <p className="text-lg text-gray mt-6 max-w-2xl mx-auto font-display italic">
              See how Bite Me stacks up against the average protein bar.
              <br />
              Spoiler: it&apos;s not even close.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* What You're Really Eating */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-burgundy text-center mb-4">
              What you&apos;re <span className="italic">really</span> eating
            </h2>
            <p className="text-gray text-center mb-12 max-w-xl mx-auto">
              Flip the label. Read the fine print. Here&apos;s what&apos;s
              actually inside.
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Bad column */}
            <ScrollReveal delay={0.1}>
              <div className="card-bakery rounded-3xl p-8 border-2 border-red/20 relative overflow-hidden">
                <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-red/10 flex items-center justify-center text-lg">
                  👎
                </div>
                <h3 className="font-display text-xl text-dark mb-1">
                  Typical Protein Bar
                </h3>
                <p className="text-gray text-sm mb-6 italic">
                  The one collecting dust in your pantry
                </p>
                <div className="space-y-4">
                  {badIngredients.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <span className="text-2xl shrink-0">{item.emoji}</span>
                      <span className="text-dark/70 line-through decoration-red/50 decoration-2">
                        {item.text}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            {/* Good column */}
            <ScrollReveal delay={0.2}>
              <div className="card-bakery rounded-3xl p-8 border-2 border-green/30 relative overflow-hidden">
                <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-green/10 flex items-center justify-center text-lg">
                  👍
                </div>
                <h3 className="font-display text-xl text-burgundy mb-1">
                  Bite Me Protein
                </h3>
                <p className="text-salmon text-sm mb-6 italic">
                  The one you actually want to eat
                </p>
                <div className="space-y-4">
                  {goodIngredients.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <span className="text-2xl shrink-0">{item.emoji}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-green text-lg font-bold">
                          &#10003;
                        </span>
                        <span className="text-dark font-medium">
                          {item.text}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* The Numbers */}
      <section className="py-20 bg-cream/30">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-burgundy text-center mb-2">
              The Numbers Don&apos;t Lie
            </h2>
            <p className="text-gray text-center mb-14 max-w-md mx-auto">
              Side by side. No spin. Just facts.
            </p>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.map((stat, i) => (
              <ScrollReveal key={stat.name} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: -4, scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="card-bakery rounded-2xl p-6 text-center h-full flex flex-col justify-between"
                >
                  <p className="text-sm font-bold uppercase tracking-widest text-gray/60 mb-4">
                    {stat.name}
                  </p>

                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div>
                      <p className="font-fun text-4xl md:text-5xl text-burgundy leading-none">
                        {stat.biteMe}
                      </p>
                      <p className="text-xs text-burgundy/60 mt-1 font-semibold">
                        Bite Me
                      </p>
                    </div>
                    <span className="text-gray/40 text-sm font-display italic">
                      vs
                    </span>
                    <div>
                      <p className="font-display text-2xl md:text-3xl text-gray/40 leading-none line-through decoration-2">
                        {stat.competitor}
                      </p>
                      <p className="text-xs text-gray/40 mt-1">Avg Bar</p>
                    </div>
                  </div>

                  <p className="text-sm text-salmon font-medium italic">
                    {stat.line}
                  </p>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Why People Switch */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-burgundy text-center mb-2">
              Why People Switch
            </h2>
            <p className="text-gray text-center mb-14 max-w-md mx-auto">
              Real humans. Real opinions. Real converts.
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <ScrollReveal key={i} delay={i * 0.12}>
                <motion.div
                  whileHover={{ rotate: i === 1 ? -1 : 1, scale: 1.02 }}
                  className="card-bakery rounded-2xl p-8 h-full flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="absolute -top-2 -left-2 text-6xl text-salmon/15 font-display leading-none select-none">
                    &ldquo;
                  </div>
                  <p className="text-dark relative z-10 mb-6 leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="relative z-10">
                    <p className="font-bold text-burgundy">{t.name}</p>
                    <p className="text-sm text-gray italic">{t.detail}</p>
                  </div>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Bold CTA */}
      <section className="py-16 pb-24">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="bg-burgundy rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
              <div className="absolute top-6 left-8 w-20 h-20 bg-salmon/20 rounded-full animate-float" />
              <div className="absolute bottom-8 right-10 w-14 h-14 bg-golden/20 rounded-full animate-float-reverse" />
              <div className="absolute top-1/2 left-[15%] w-10 h-10 bg-cream/10 rounded-full animate-bounce-gentle" />
              <div className="absolute bottom-12 left-[40%] w-8 h-8 bg-salmon-light/15 rounded-full animate-wiggle" />

              <h2 className="font-display text-3xl md:text-4xl text-cream mb-3 relative z-10">
                Ready to taste the difference?
              </h2>
              <p className="font-fun text-4xl md:text-5xl text-salmon-light relative z-10 mb-4">
                Your taste buds deserve better.
              </p>
              <p className="text-cream/60 max-w-lg mx-auto relative z-10 mb-8">
                More protein, less sugar, zero artificial ingredients, and it
                actually tastes like a dessert you&apos;d choose — not one you
                have to choke down.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
                <Link
                  href="/shop"
                  className="btn-fun inline-flex items-center justify-center px-8 py-4 text-base font-semibold hover:scale-105 transition-transform"
                >
                  Shop Now
                </Link>
                <Link
                  href="/quiz"
                  className="btn-secondary inline-flex items-center justify-center px-8 py-4 text-base font-medium bg-cream/10 text-cream border-cream/30 hover:bg-cream/20 hover:scale-105 transition-all"
                >
                  Take the Quiz
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
