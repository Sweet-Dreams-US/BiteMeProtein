import type { Metadata } from "next";
import Image from "next/image";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";
import { images } from "@/lib/images";

export const metadata: Metadata = {
  title: "Trainers & Gyms | Bite Me Protein Bakery",
  description:
    "Partner with Bite Me for bulk pricing, custom orders, and protein treats your clients will actually love.",
};

const benefits = [
  {
    icon: "💰",
    title: "Bulk Pricing",
    description:
      "Wholesale rates for gyms, studios, and trainers ordering regularly. The more you order, the better the price.",
  },
  {
    icon: "🎨",
    title: "Custom Orders",
    description:
      "Need a specific flavor or macros? We'll work with you to create custom treats for your clients.",
  },
  {
    icon: "🏪",
    title: "Branded Display",
    description:
      "We'll provide branded display materials for your front desk, break room, or smoothie bar.",
  },
  {
    icon: "❤️",
    title: "Client Favorites",
    description:
      "Your clients will actually look forward to their post-workout snack. Better retention, happier gym-goers.",
  },
];

const tiers = [
  {
    name: "Starter",
    description: "Perfect for personal trainers",
    features: [
      "10% off all orders",
      "Weekly delivery available",
      "Minimum 12 tins per order",
    ],
  },
  {
    name: "Gym Partner",
    description: "For gyms and studios",
    features: [
      "20% off all orders",
      "Bi-weekly delivery included",
      "Branded display stand",
      "Custom flavor requests",
      "Minimum 36 tins per order",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    description: "Multi-location or high-volume",
    features: [
      "Best pricing — let's talk",
      "Scheduled delivery",
      "Co-branded packaging available",
      "Dedicated account manager",
      "Custom macros and flavors",
    ],
  },
];

export default function TrainersPage() {
  return (
    <>
      {/* ===== BRANDED TYPOGRAPHY HEADER ===== */}
      <section className="pt-16 pb-10 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-10 right-20 w-24 h-24 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-12 left-8 w-16 h-16 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-6">Partner With Us</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="font-fun text-burgundy text-5xl md:text-7xl mb-4">
              Your clients deserve <AnimatedSquiggly>better.</AnimatedSquiggly>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-dark/50 max-w-xl">
              Partner with Bite Me to offer fresh, high-protein treats at your gym, studio, or training business.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== BENEFITS ===== */}
      <section className="py-24 md:py-32 bg-white relative overflow-hidden">
        <div className="absolute top-16 right-12 w-20 h-20 rounded-full bg-golden-light/30 animate-float" />
        <div className="absolute bottom-20 left-8 w-14 h-14 rounded-full bg-salmon/15 animate-float-reverse" />

        <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="mb-16">
              <p className="stamp text-burgundy mb-4">Why Partner</p>
              <h2 className="text-section font-fun text-burgundy">
                Why gyms partner with us.
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefits.map((b, i) => (
              <ScrollReveal key={b.title} delay={i * 0.1}>
                <div className="card-bakery p-8 h-full hover:shadow-lg transition-shadow">
                  <span className="text-3xl mb-4 block">{b.icon}</span>
                  <h3 className="text-dark text-xl font-bold mb-3 font-display">
                    {b.title}
                  </h3>
                  <p className="text-gray leading-relaxed">{b.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRODUCT PHOTO BREAK ===== */}
      <section className="relative h-[35vh] overflow-hidden">
        <Image
          src={images.allProducts4}
          alt="Bite Me products"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-cream/40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <ScrollReveal>
            <p
              className="font-fun text-white text-3xl md:text-5xl text-center px-6"
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
            >
              Dessert... but make it protein.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== PARTNERSHIP TIERS ===== */}
      <section className="py-24 md:py-32 bg-cream relative overflow-hidden">
        <div className="absolute top-10 left-16 w-16 h-16 rounded-full bg-burgundy/10 animate-float" />
        <div className="absolute bottom-16 right-12 w-12 h-12 rounded-full bg-golden/20 animate-float-reverse" />

        <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <p className="stamp text-burgundy mb-4">Partnership Tiers</p>
              <h2 className="text-section font-display text-dark">
                Pick your level.
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {tiers.map((tier, i) => (
              <ScrollReveal key={tier.name} delay={i * 0.1}>
                <div
                  className={`card-bakery p-8 h-full flex flex-col relative transition-shadow hover:shadow-lg ${
                    tier.featured
                      ? "border-2 !border-burgundy shadow-lg"
                      : ""
                  }`}
                >
                  {tier.featured && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-burgundy text-white text-xs font-bold px-5 py-1.5 rounded-full shadow-md">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-dark text-xl font-bold mb-1 font-display">
                    {tier.name}
                  </h3>
                  <p className="text-gray text-sm mb-6">{tier.description}</p>
                  <ul className="space-y-3 flex-1">
                    {tier.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2.5 text-dark/70 text-sm"
                      >
                        <span className="text-burgundy mt-0.5 font-bold">
                          &#10003;
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="mailto:haley@bitemeprotein.com"
                    className={`mt-8 inline-flex items-center justify-center py-3 rounded-full text-sm font-bold transition-all text-center ${
                      tier.featured
                        ? "btn-primary w-full"
                        : "btn-secondary w-full"
                    }`}
                  >
                    Get Started
                  </a>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONTACT CTA ===== */}
      <section className="py-24 md:py-32 bg-burgundy relative overflow-hidden">
        <div className="absolute top-10 right-16 w-20 h-20 rounded-full bg-white/10 animate-float" />
        <div className="absolute bottom-10 left-12 w-14 h-14 rounded-full bg-salmon/20 animate-float-reverse" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-section font-fun text-white mb-4">
              Let&apos;s talk protein.
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-lg mx-auto">
              Whether you&apos;re a solo trainer or a multi-location gym,
              we&apos;ll find the right partnership for you.
            </p>
            <a
              href="mailto:haley@bitemeprotein.com"
              className="inline-flex items-center justify-center bg-white text-burgundy px-8 py-4 rounded-full text-base font-bold hover:bg-cream transition-all hover:scale-105 shadow-lg"
            >
              Contact Us
            </a>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
