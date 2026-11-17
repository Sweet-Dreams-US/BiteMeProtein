import Link from "next/link";
import ScrollReveal from "@/components/animations/ScrollReveal";

/**
 * Promo strip linking to /thanksgiving. Drop it on any page; remove the
 * usages (home + shop) once the Thanksgiving preorder window closes.
 */
export default function ThanksgivingBanner({ className = "" }: { className?: string }) {
  return (
    <section className={`bg-bitepink-pale ${className}`}>
      <div className="dots-pink" aria-hidden />
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-10 md:py-12">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div className="flex items-center gap-4">
              <span className="text-5xl md:text-6xl" aria-hidden>🦃</span>
              <div>
                <p className="font-fun text-bitepink-dark text-3xl md:text-4xl leading-tight">Thanksgiving pre-orders are open!</p>
                <p className="text-dark/70 mt-1">Pies, tarts, keto &amp; vegan treats, and build-your-own Gobble Boxes.</p>
              </div>
            </div>
            <Link
              href="/thanksgiving"
              className="shrink-0 inline-flex items-center justify-center rounded-full bg-bitepink hover:bg-bitepink-dark text-white font-bold px-8 py-3.5 shadow-lg transition-colors"
            >
              Pre-order now
            </Link>
          </div>
        </ScrollReveal>
      </div>
      <div className="dots-pink" aria-hidden />
    </section>
  );
}
