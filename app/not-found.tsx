import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found — Bite Me Protein Bakery",
  description: "We couldn't find that page. Head back to the shop.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="min-h-[70vh] flex items-center justify-center px-6 py-20 bg-cream">
      <div className="text-center max-w-md">
        <p className="text-7xl md:text-8xl mb-6">🧁</p>
        <p className="stamp text-burgundy mb-4">404</p>
        <h1 className="font-fun text-burgundy text-4xl md:text-5xl mb-4">
          We baked a page called that.
        </h1>
        <p className="text-dark/60 mb-8">
          Just kidding — this page doesn&apos;t exist. Let&apos;s get you back to the treats.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-primary">
            Back to home
          </Link>
          <Link href="/shop" className="btn-secondary">
            Shop now
          </Link>
        </div>
      </div>
    </section>
  );
}
