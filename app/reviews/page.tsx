import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";

export const metadata: Metadata = {
  title: "Reviews | Bite Me Protein Bakery",
  description:
    "See what people are saying about Bite Me Protein Bakery. Real reviews from real customers who love our high-protein treats.",
};

const testimonials = [
  {
    quote:
      "I brought these to my gym and they were gone in 10 minutes. Everyone was asking where to order.",
    name: "Sarah M.",
    ordered: "Brownies",
    emoji: "🏋️",
  },
  {
    quote:
      "Finally a protein treat that doesn't taste like chalk. The banana bread is insane.",
    name: "Jake R.",
    ordered: "Banana Bread",
    emoji: "🍞",
  },
  {
    quote:
      "I'm obsessed with the cookie dough truffles. My kids think they're regular desserts.",
    name: "Maria L.",
    ordered: "Truffles",
    emoji: "🍫",
  },
  {
    quote:
      "Perfect post-workout snack. High protein, tastes amazing, and I don't feel guilty.",
    name: "Chris D.",
    ordered: "Muffins",
    emoji: "💪",
  },
  {
    quote:
      "Ordered the 8-pack for shipping and everything arrived fresh. Will be ordering again.",
    name: "Amanda K.",
    ordered: "8-Pack Bundle",
    emoji: "📦",
  },
  {
    quote:
      "We use Bite Me for our gym's front desk display. Clients love them.",
    name: "Iron Athletics Gym",
    ordered: "Gym Partnership",
    emoji: "🏢",
  },
];

function StarRow() {
  return (
    <div className="flex gap-0.5 mb-4">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className="w-5 h-5 text-golden"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="pt-16 pb-10 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-14 right-16 w-24 h-24 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-10 left-10 w-16 h-16 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="absolute top-1/3 right-1/3 w-10 h-10 rounded-full bg-burgundy/10 animate-float" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-6">Reviews</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="font-fun text-burgundy text-5xl md:text-7xl max-w-3xl mx-auto">
              What people are <AnimatedSquiggly>saying.</AnimatedSquiggly>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-gray max-w-2xl mx-auto mt-6">
              Don&apos;t take our word for it. Here&apos;s what our customers have to say about Bite Me treats.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== TESTIMONIAL GRID ===== */}
      <section className="py-20 bg-cream relative overflow-hidden">
        <div className="absolute bottom-20 right-16 w-20 h-20 rounded-full bg-golden/15 animate-float" />
        <div className="absolute top-16 left-12 w-12 h-12 rounded-full bg-salmon/15 animate-float-reverse" />

        <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <ScrollReveal key={t.name} delay={i * 0.08}>
                <div className="card-bakery p-8 h-full flex flex-col hover:shadow-lg transition-shadow">
                  <span className="text-3xl mb-3 block">{t.emoji}</span>
                  <StarRow />
                  <blockquote className="text-dark leading-relaxed flex-1 mb-6">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div className="border-t border-[#e8ddd4] pt-4 mt-auto">
                    <p className="text-dark font-bold text-sm">{t.name}</p>
                    <p className="text-dark/40 text-xs">Ordered: {t.ordered}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LEAVE A REVIEW ===== */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="absolute top-10 right-14 w-14 h-14 rounded-full bg-burgundy/8 animate-float" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-12">
              <p className="stamp text-burgundy mb-4">Your Turn</p>
              <h2 className="text-section font-fun text-burgundy">
                Leave a review.
              </h2>
              <p className="text-gray text-lg max-w-lg mx-auto mt-4">
                Tried our treats? We&apos;d love to hear about it. Share your experience and help others discover Bite Me.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ScrollReveal>
              <a
                href="https://instagram.com/biteme_protein"
                target="_blank"
                rel="noopener noreferrer"
                className="card-bakery p-8 text-center block hover:shadow-lg transition-all group"
              >
                <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform">📸</span>
                <h3 className="text-dark font-bold text-lg mb-2">Review on Instagram</h3>
                <p className="text-dark/50 text-sm">
                  Tag @biteme_protein in your post or story and we&apos;ll share it.
                </p>
              </a>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <a
                href="mailto:bitemeproteinbakery@gmail.com?subject=Customer%20Review&body=Hi%20Bite%20Me%20team!%20I%20wanted%20to%20share%20my%20experience..."
                className="card-bakery p-8 text-center block hover:shadow-lg transition-all group"
              >
                <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform">✍️</span>
                <h3 className="text-dark font-bold text-lg mb-2">Email Your Review</h3>
                <p className="text-dark/50 text-sm">
                  Send us your thoughts and we may feature your review on our site.
                </p>
              </a>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ===== SHARE YOUR EXPERIENCE ===== */}
      <section className="py-20 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-8 left-16 w-16 h-16 rounded-full bg-salmon/20 animate-float-reverse" />
        <div className="absolute bottom-10 right-12 w-14 h-14 rounded-full bg-golden/20 animate-float" />

        <div className="relative max-w-3xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="card-bakery p-10 md:p-14 text-center">
              <span className="text-5xl mb-6 block">🌟</span>
              <h2 className="font-fun text-burgundy text-3xl md:text-4xl mb-4">
                Share Your Experience
              </h2>
              <p className="text-gray text-lg max-w-md mx-auto mb-8 leading-relaxed">
                Love Bite Me? Leave a review on Google or share a photo on Instagram. Your feedback helps us keep baking and helps others find treats worth eating.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <a
                  href="https://instagram.com/biteme_protein"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  Post on Instagram
                </a>
                <a
                  href="mailto:bitemeproteinbakery@gmail.com?subject=Google%20Review%20Request"
                  className="btn-secondary"
                >
                  Leave a Google Review
                </a>
              </div>
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
              Ready to try it yourself?
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-lg mx-auto">
              See what everyone&apos;s talking about. Order your first box today.
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
