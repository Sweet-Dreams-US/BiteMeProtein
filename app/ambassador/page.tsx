import type { Metadata } from "next";
import Image from "next/image";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";
import { images } from "@/lib/images";

export const metadata: Metadata = {
  title: "Brand Ambassadors | Bite Me Protein Bakery",
  description:
    "Join the Bite Me ambassador crew. Free products, exclusive codes, and commissions on every sale.",
};

const perks = [
  { title: "Free Products", description: "Monthly boxes of your favorite Bite Me treats to fuel your content and your workouts." },
  { title: "Exclusive Discount Code", description: "Your own custom code to share with followers. They save, you earn." },
  { title: "Commission on Sales", description: "Earn a percentage on every sale through your link. The more you share, the more you make." },
  { title: "Early Access", description: "Be the first to try new flavors, seasonal drops, and limited editions before anyone else." },
  { title: "Feature on Our Page", description: "Get featured on our website, Instagram, and marketing materials. We hype our ambassadors." },
  { title: "Community", description: "Join a crew of fitness-loving, treat-obsessed ambassadors who actually enjoy what they promote." },
];

const requirements = [
  "Active on social media (Instagram, TikTok, or YouTube)",
  "Passionate about fitness, health, or food",
  "Genuinely love protein treats (we can tell when you don't)",
  "Consistent content creation (at least 2-3 posts per month)",
  "Positive, authentic energy that matches our brand",
];

export default function AmbassadorPage() {
  return (
    <>
      {/* ===== BRANDED TYPOGRAPHY HEADER ===== */}
      <section className="pt-16 pb-10 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-8 right-12 w-20 h-20 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-10 left-16 w-14 h-14 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-6">Join the Crew</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="font-fun text-burgundy text-5xl md:text-7xl mb-4">
              Brand <AnimatedSquiggly>Ambassadors</AnimatedSquiggly>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-dark/50 max-w-xl">
              Love Bite Me? Want free treats, exclusive perks, and the chance to earn money doing what you already do?
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Perks */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <p className="stamp text-burgundy mb-6">Perks</p>
              <h2 className="font-fun text-burgundy text-section">What you get.</h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {perks.map((perk, i) => (
              <ScrollReveal key={perk.title} delay={i * 0.08}>
                <div className="card-bakery p-7 h-full">
                  <h3 className="text-dark font-bold text-lg mb-2">{perk.title}</h3>
                  <p className="text-gray text-sm leading-relaxed">{perk.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Photo break */}
      <section className="relative h-[35vh] overflow-hidden">
        <Image src={images.allMuffins1} alt="Muffins" fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-cream/30" />
      </section>

      {/* Requirements */}
      <section className="py-24 bg-cream">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="font-fun text-burgundy text-section">Who we&apos;re looking for.</h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="card-bakery p-8 md:p-12">
              <ul className="space-y-4">
                {requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-3 text-dark">
                    <span className="text-burgundy font-bold mt-0.5">✓</span>
                    <span className="text-base">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Apply CTA */}
      <section className="py-24 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-10 right-16 w-20 h-20 rounded-full bg-salmon/20 animate-float" />
        <div className="absolute bottom-10 left-10 w-14 h-14 rounded-full bg-golden/30 animate-float-reverse" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="font-fun text-burgundy text-section mb-4">Ready to rep Bite Me?</h2>
            <p className="text-dark/60 mb-8 max-w-md mx-auto">
              Apply below and we&apos;ll be in touch. Include your social media handles and why you&apos;d be a great fit.
            </p>
            <a href="mailto:haley@bitemeprotein.com?subject=Brand Ambassador Application"
              className="btn-primary text-lg px-10 py-4">
              Apply Now
            </a>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
