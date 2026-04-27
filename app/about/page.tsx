import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";
import { images } from "@/lib/images";

export const metadata: Metadata = {
  title: "About | Bite Me Protein Bakery",
  description:
    "Hi, I'm Haley — the girl behind Bite Me Protein Bakery. Real ingredients, high protein, lower sugar, and made to be craved.",
};

const values = [
  {
    title: "Real Ingredients",
    description:
      "No artificial sweeteners, no fillers, no preservatives. Just real food that happens to be high in protein.",
  },
  {
    title: "Fresh, Not Packaged",
    description:
      "Everything is baked fresh in small batches. No shelf-stable bars sitting in a warehouse for months.",
  },
  {
    title: "Taste First",
    description:
      "If it doesn't taste like a real dessert, we don't sell it. Period.",
  },
  {
    title: "Mom-Approved",
    description:
      "My mom hates the taste of protein powder. If something tastes even slightly artificial, it doesn't make the cut.",
  },
  {
    title: "Eat It Now or Freeze It",
    description:
      "Our treats are made fresh and meant to be enjoyed right away. Not ready yet? Pop them in the freezer and they'll taste just as good later.",
  },
  {
    title: "Made to be Craved",
    description:
      "High-protein, lower-sugar, and made to be craved — not settled for.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="pt-16 pb-10 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-16 right-16 w-24 h-24 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-10 left-8 w-16 h-16 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="absolute top-1/3 right-1/3 w-10 h-10 rounded-full bg-burgundy/10 animate-float" />

        <div className="relative max-w-5xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-6">Meet Haley</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="font-fun text-burgundy text-5xl md:text-7xl max-w-3xl mx-auto">
              Hi, I&apos;m Haley — the girl behind{" "}
              <AnimatedSquiggly>Bite Me.</AnimatedSquiggly>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-gray max-w-2xl mx-auto mt-6">
              Bite Me Protein Bakery was created to redefine protein desserts —
              elevated, craveable, and designed to fit your lifestyle.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== HALEY PHOTO GRID — 4 personal photos ===== */}
      <section className="py-4 bg-cream">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScrollReveal className="aspect-square rounded-2xl overflow-hidden relative shadow-lg">
              <Image
                src={images.about.haley1}
                alt="Haley"
                fill
                className="object-cover hover:scale-105 transition-transform duration-700"
              />
            </ScrollReveal>
            <ScrollReveal delay={0.1} className="aspect-square rounded-2xl overflow-hidden relative shadow-lg">
              <Image
                src={images.about.haley2}
                alt="Haley"
                fill
                className="object-cover hover:scale-105 transition-transform duration-700"
              />
            </ScrollReveal>
            <ScrollReveal delay={0.2} className="aspect-square rounded-2xl overflow-hidden relative shadow-lg">
              <Image
                src={images.about.haley3}
                alt="Haley"
                fill
                className="object-cover hover:scale-105 transition-transform duration-700"
              />
            </ScrollReveal>
            <ScrollReveal delay={0.3} className="aspect-square rounded-2xl overflow-hidden relative shadow-lg">
              <Image
                src={images.about.haley4}
                alt="Haley"
                fill
                className="object-cover hover:scale-105 transition-transform duration-700"
              />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ===== BEHIND THE BITE ===== */}
      <section className="py-24 md:py-32 bg-white relative overflow-hidden">
        <div className="absolute bottom-16 right-12 w-20 h-20 rounded-full bg-golden-light/30 animate-float" />
        <div className="absolute top-20 left-8 w-14 h-14 rounded-full bg-salmon/15 animate-float-reverse" />

        <div className="relative max-w-3xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-6">Behind the Bite</p>
            <h2 className="text-section font-fun text-burgundy mb-10">
              A little bit me. A little bit mom.
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="space-y-6 text-gray text-lg leading-relaxed">
              <p>
                But this didn&apos;t happen alone.
              </p>
              <p>
                While I&apos;m the one you see, my mom has been right there behind the scenes from the very beginning — taste-testing more batches than anyone, helping bring ideas to life, and supporting me through every step of building this brand.
              </p>
              <p className="text-burgundy font-display italic text-xl">
                And here&apos;s the thing — she hates the taste of protein powder.
              </p>
              <p>
                So if something tastes even slightly artificial or &ldquo;too protein,&rdquo; it doesn&apos;t make the cut. Period.
              </p>
              <p>
                That&apos;s become our standard: if it doesn&apos;t taste like a real dessert, we don&apos;t sell it.
              </p>
              <p>
                There were moments this felt overwhelming, but she always reminded me to keep going — and that support is a huge part of why Bite Me exists today.
              </p>
              <p>
                Together, we turned something small into something we&apos;re really proud of.
              </p>
              <p>
                Now, everything you see here is high-protein, lower-sugar, and made to be craved — not settled for. Think soft banana bread, rich brownies, and muffins that actually hit.
              </p>
              <p className="text-burgundy font-display italic text-xl">
                So yes — it&apos;s Bite Me... but it&apos;s also a little bit us.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== IN THE KITCHEN — wide action shots =====
          Three wide-orientation photos sit nicely under the "Behind the
          Bite" prose section: candid baking shots tied to the narrative
          of "made by Haley + mom." Aspect-video keeps them matching the
          home-page lifestyle grid rhythm. */}
      <section className="py-4 bg-cream">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScrollReveal className="aspect-video rounded-2xl overflow-hidden relative shadow-lg">
              <Image src={images.about.haleyBakingWide1} alt="Haley baking" fill className="object-cover hover:scale-105 transition-transform duration-700" />
            </ScrollReveal>
            <ScrollReveal delay={0.1} className="aspect-video rounded-2xl overflow-hidden relative shadow-lg">
              <Image src={images.about.haleyHoldingBananaWide} alt="Haley with banana" fill className="object-cover hover:scale-105 transition-transform duration-700" />
            </ScrollReveal>
            <ScrollReveal delay={0.2} className="aspect-video rounded-2xl overflow-hidden relative shadow-lg">
              <Image src={images.about.haleyBakingWide2} alt="In the kitchen" fill className="object-cover hover:scale-105 transition-transform duration-700" />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ===== BRAND STATEMENT ===== */}
      <section className="py-20 bg-burgundy relative overflow-hidden">
        <div className="absolute top-6 right-10 w-16 h-16 rounded-full bg-white/10 animate-float" />
        <div className="absolute bottom-8 left-14 w-12 h-12 rounded-full bg-salmon/20 animate-float-reverse" />

        <div className="relative max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="font-fun text-white text-hero mb-6">
              Every product is crafted to feel indulgent while supporting your goals.
            </p>
            <p className="text-white/60 text-lg">
              Because it should taste as good as it looks.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== PRODUCT PHOTO GRID ===== */}
      <section className="py-4 bg-cream">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <ScrollReveal className="aspect-video rounded-2xl overflow-hidden relative shadow-md">
              <Image
                src={images.brownieHearts[2]}
                alt="Brownie hearts"
                fill
                className="object-cover hover:scale-105 transition-transform duration-700"
              />
            </ScrollReveal>
            <ScrollReveal
              delay={0.1}
              className="aspect-video rounded-2xl overflow-hidden relative shadow-md"
            >
              <Image
                src={images.allMuffins1}
                alt="Protein muffins"
                fill
                className="object-cover hover:scale-105 transition-transform duration-700"
              />
            </ScrollReveal>
            <ScrollReveal
              delay={0.2}
              className="aspect-video rounded-2xl overflow-hidden relative shadow-md"
            >
              <Image
                src={images.chocolateTruffles[1]}
                alt="Chocolate truffles"
                fill
                className="object-cover hover:scale-105 transition-transform duration-700"
              />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ===== VALUES ===== */}
      <section className="py-24 md:py-32 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-12 left-16 w-14 h-14 rounded-full bg-salmon/20 animate-float-reverse" />
        <div className="absolute bottom-20 right-20 w-20 h-20 rounded-full bg-golden/20 animate-float" />

        <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <p className="stamp text-burgundy mb-4">What We Stand For</p>
              <h2 className="text-section font-display text-dark">
                Our non-negotiables.
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value, i) => (
              <ScrollReveal key={value.title} delay={i * 0.1}>
                <div className="card-bakery p-8 h-full hover:shadow-lg transition-shadow">
                  <h3 className="text-dark text-xl font-bold mb-3 font-display">
                    {value.title}
                  </h3>
                  <p className="text-gray leading-relaxed">
                    {value.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-24 md:py-32 bg-burgundy relative overflow-hidden">
        <div className="absolute top-8 right-12 w-16 h-16 rounded-full bg-white/10 animate-float" />
        <div className="absolute bottom-8 left-16 w-12 h-12 rounded-full bg-salmon/20 animate-float-reverse" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="stamp bg-white/10 text-salmon-light border-white/20 mb-6 inline-block">
              Warning
            </p>
            <h2 className="text-section font-fun text-white mb-4">
              Consider this your new obsession.
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-lg mx-auto">
              Real desserts. Real protein. No compromises.
            </p>
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
