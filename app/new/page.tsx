import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";

export const metadata: Metadata = {
  title: "New & Limited Edition | Bite Me Protein Bakery",
  description:
    "Seasonal drops, limited edition flavors, and new arrivals. Be the first to try what's baking next at Bite Me Protein Bakery.",
};

export default function NewPage() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="pt-16 pb-10 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-12 right-20 w-24 h-24 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-10 left-8 w-16 h-16 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="absolute top-1/3 left-1/4 w-10 h-10 rounded-full bg-burgundy/10 animate-float" />
        <div className="absolute top-1/2 right-1/3 w-8 h-8 rounded-full bg-green/10 animate-float-reverse" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-6">What&apos;s New</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="font-fun text-burgundy text-5xl md:text-7xl max-w-3xl mx-auto">
              Limited <AnimatedSquiggly>Edition</AnimatedSquiggly>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-gray max-w-2xl mx-auto mt-6">
              Seasonal drops, new flavors, and small-batch experiments. This is where they land first.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== INTRO ===== */}
      <section className="py-20 bg-cream relative overflow-hidden">
        <div className="absolute bottom-16 right-10 w-20 h-20 rounded-full bg-golden/15 animate-float" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center max-w-2xl mx-auto">
              <p className="stamp text-burgundy mb-4">How It Works</p>
              <h2 className="text-section font-display text-dark mb-6">
                Small batches. Limited runs.
              </h2>
              <p className="text-gray text-lg leading-relaxed">
                We&apos;re always experimenting in the kitchen. When we land on something special, it drops here as a limited edition. Some become permanent menu items. Some don&apos;t. The only way to never miss out is to follow along.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== COMING SOON ===== */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="absolute top-10 left-16 w-14 h-14 rounded-full bg-salmon/15 animate-float-reverse" />
        <div className="absolute bottom-12 right-20 w-18 h-18 rounded-full bg-burgundy/8 animate-float" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-12">
              <p className="stamp text-burgundy mb-4">Coming Soon</p>
              <h2 className="text-section font-fun text-burgundy">
                Something&apos;s baking.
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ScrollReveal>
              <div className="card-bakery p-8 h-full relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-burgundy text-white text-xs font-bold px-3 py-1 rounded-full">
                  SOON
                </div>
                <span className="text-4xl mb-4 block">🍫</span>
                <h3 className="font-display text-dark text-xl font-bold mb-3">
                  Seasonal Flavor Drop
                </h3>
                <p className="text-gray leading-relaxed">
                  We&apos;re testing new seasonal recipes in the kitchen right now. Think warm spices, fresh fruit, and unexpected combos — all with the protein punch you expect.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <div className="card-bakery p-8 h-full relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-golden text-dark text-xs font-bold px-3 py-1 rounded-full">
                  IN THE LAB
                </div>
                <span className="text-4xl mb-4 block">🧪</span>
                <h3 className="font-display text-dark text-xl font-bold mb-3">
                  New Format Experiments
                </h3>
                <p className="text-gray leading-relaxed">
                  We&apos;re exploring new ways to deliver protein-packed treats. New shapes, new sizes, new experiences. Stay tuned for some surprises.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ===== GET NOTIFIED ===== */}
      <section className="py-20 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-8 right-14 w-16 h-16 rounded-full bg-salmon/20 animate-float" />
        <div className="absolute bottom-10 left-12 w-12 h-12 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="absolute top-1/2 left-1/3 w-8 h-8 rounded-full bg-burgundy/10 animate-float" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="card-bakery p-10 md:p-14 text-center">
              <span className="text-5xl mb-6 block">📸</span>
              <h2 className="font-fun text-burgundy text-3xl md:text-4xl mb-4">
                Get Notified First
              </h2>
              <p className="text-gray text-lg max-w-lg mx-auto mb-8 leading-relaxed">
                Every new drop, seasonal flavor, and limited edition release gets announced on our Instagram first. Follow along so you never miss one.
              </p>
              <a
                href="https://instagram.com/biteme_protein"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2"
              >
                Follow @biteme_protein
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 bg-burgundy relative overflow-hidden">
        <div className="absolute top-8 right-12 w-16 h-16 rounded-full bg-white/10 animate-float" />
        <div className="absolute bottom-8 left-16 w-12 h-12 rounded-full bg-salmon/20 animate-float-reverse" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-section font-fun text-white mb-4">
              Don&apos;t miss out.
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-lg mx-auto">
              Limited editions sell out fast. Get plugged in so you&apos;re first in line.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a
                href="https://instagram.com/biteme_protein"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-white text-burgundy px-8 py-4 rounded-full text-base font-bold hover:bg-cream transition-all hover:scale-105 shadow-lg"
              >
                Instagram
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center bg-transparent text-white border-2 border-white/40 px-8 py-4 rounded-full text-base font-bold hover:bg-white/10 transition-all hover:scale-105"
              >
                Contact Us
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
