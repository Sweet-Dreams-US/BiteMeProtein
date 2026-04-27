"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";
import Marquee from "@/components/animations/Marquee";
import ScrollVideo from "@/components/animations/ScrollVideo";
import { images } from "@/lib/images";
import { brand } from "@/lib/brand";
import { useContent } from "@/lib/content";
import { supabase } from "@/lib/supabase";


const HERO_VIDEO = "https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/hf_20260404_191224_52bb54af-2a44-49e9-8306-d6e9c97e3d1f.mp4";

interface Product {
  id: string;
  name: string;
  description: string;
  variations: { id: string; name: string; priceMoney: { amount: number } | null }[];
}

interface BestSellerCard {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  image_alt: string | null;
}

const DEFAULT_TESTIMONIALS = [
  "Best protein dessert I've ever had.",
  "I don't even like protein bars anymore.",
  "This should be illegal.",
  "My gym bag essential.",
  "Tastes like actual dessert.",
  "I'm never going back to chalky bars.",
  "My post-workout obsession.",
  "Where has this been all my life?",
];

/**
 * Fuzzy match: does this image slug relate to this product name?
 * "Protein Brownies" vs slug "brownieHearts" → true (both share "brownie").
 * Used as a last-resort fallback when admin hasn't linked a slug to a
 * square_product_id via /admin/product-images yet.
 */
function slugMatchesName(name: string, slug: string): boolean {
  const nameWords = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  const slugWords = slug
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  if (nameWords.length === 0 || slugWords.length === 0) return false;
  return nameWords.some((nw) => slugWords.some((sw) => sw.startsWith(nw) || nw.startsWith(sw)));
}

function HeroTitle() {
  const [opacity, setOpacity] = useState(1);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      // Fade out over the first 60% of viewport height (slow, cinematic)
      const fadeEnd = window.innerHeight * 0.6;
      const progress = Math.min(1, scrollY / fadeEnd);
      setOpacity(Math.max(0, 1 - progress));
      // Subtle scale-down as you scroll (1 → 0.92)
      setScale(1 - progress * 0.08);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
      style={{ opacity, transform: `scale(${scale})` }}
    >
      <div className="text-center px-6">
        <h1
          className="font-fun text-white text-7xl md:text-9xl lg:text-[10rem] select-none leading-none"
          style={{ textShadow: "0 6px 40px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.4)" }}
        >
          Bite Me
        </h1>
        <p
          className="text-white/80 text-sm md:text-lg tracking-[0.35em] uppercase font-semibold mt-4"
          style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
        >
          Protein Bakery
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  // Hero copy is editable from /admin/content; fallbacks match the original
  // hard-coded values, so the page renders identically until Haley edits.
  const subtext = useContent<string>(
    "hero.subtitle",
    "Soft, fresh, high-protein treats that actually taste like dessert. Not your average protein snack.",
  );
  const ctaPrimary = useContent<string>("hero.cta_primary", "Shop Now");
  const ctaSecondary = useContent<string>("hero.cta_secondary", "Take the Quiz");
  const testimonialStrings = useContent<string[]>("home.testimonials", DEFAULT_TESTIMONIALS);

  // Accept both string[] (legacy) and object[] (richer format) for testimonials.
  const testimonials: string[] = Array.isArray(testimonialStrings)
    ? testimonialStrings.map((t) => (typeof t === "string" ? t : (t as { quote?: string }).quote ?? ""))
    : DEFAULT_TESTIMONIALS;

  const [bestSellers, setBestSellers] = useState<BestSellerCard[]>([]);

  const fetchData = useCallback(async () => {
    try {
      // 1. Catalog + sales ranking in parallel.
      const [catalogRes, bestRes] = await Promise.all([
        fetch("/api/square/catalog"),
        fetch("/api/bestsellers?limit=10"),
      ]);

      const catalogData = await catalogRes.json();
      const catalogItems: Product[] = Array.isArray(catalogData.items) ? catalogData.items : [];
      const byName = new Map(catalogItems.map((p) => [p.name, p]));

      const cards: BestSellerCard[] = [];

      // 2. If sales data exists, use ranked bestsellers with their image_url.
      let salesItems: Array<{ name: string; image_url: string | null; image_alt: string | null }> = [];
      try {
        const bestData = await bestRes.json();
        if (bestData.source === "sales" && Array.isArray(bestData.items)) {
          salesItems = bestData.items;
        }
      } catch { /* ignore */ }

      for (const s of salesItems) {
        if (cards.length >= 4) break;
        const cat = byName.get(s.name);
        cards.push({
          id: cat?.id ?? s.name,
          name: s.name,
          description: cat?.description ?? "",
          image_url: s.image_url,
          image_alt: s.image_alt,
        });
      }

      // 3. If we still don't have 4 (empty sales or fewer than 4 ranked
      //    products), fill from the catalog. For each, try to find a
      //    product_image via slug fuzzy-match.
      if (cards.length < 4) {
        const { data: productImageRows } = await supabase
          .from("product_images")
          .select("slug, square_product_id, url, alt, sort_order")
          .eq("kind", "product")
          .order("sort_order", { ascending: true });

        const bySlug = new Map<string, { url: string; alt: string | null }>();
        for (const r of (productImageRows ?? []) as Array<{ slug: string | null; url: string; alt: string | null }>) {
          if (r.slug && !bySlug.has(r.slug)) bySlug.set(r.slug, { url: r.url, alt: r.alt });
        }

        const already = new Set(cards.map((c) => c.name));
        for (const p of catalogItems) {
          if (cards.length >= 4) break;
          if (already.has(p.name)) continue;
          let image_url: string | null = null;
          let image_alt: string | null = null;
          for (const [slug, img] of bySlug) {
            if (slugMatchesName(p.name, slug)) {
              image_url = img.url;
              image_alt = img.alt;
              break;
            }
          }
          cards.push({ id: p.id, name: p.name, description: p.description, image_url, image_alt });
        }
      }

      setBestSellers(cards.slice(0, 4));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <>
      {/* ===== HERO — SCROLL VIDEO ===== */}
      <ScrollVideo src={HERO_VIDEO} className="relative" style={{ height: "300vh" }}>
        {/* Dark gradient overlays for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none z-10" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/30 to-transparent pointer-events-none z-10" />

        {/* Center title — fades out as you scroll */}
        <HeroTitle />

        {/* Bottom bar — brand name left, tagline right, CTAs below */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-6 lg:px-8 pb-14">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <ScrollReveal>
                <p className="font-fun text-white text-3xl md:text-4xl font-bold"
                   style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>
                  Bite Me Protein Bakery
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <p className="text-white/80 text-sm md:text-base font-medium max-w-sm text-right hidden md:block"
                   style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
                  {subtext}
                </p>
              </ScrollReveal>
            </div>
            <ScrollReveal delay={0.2}>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/shop" className="bg-white text-burgundy px-8 py-4 rounded-full font-bold text-base hover:bg-cream hover:scale-105 transition-all shadow-lg inline-flex items-center justify-center">
                  {ctaPrimary}
                </Link>
                <Link href="/quiz" className="border-2 border-white text-white px-8 py-4 rounded-full font-bold text-base hover:bg-white hover:text-burgundy transition-all inline-flex items-center justify-center"
                      style={{ textShadow: "0 1px 6px rgba(0,0,0,0.3)" }}>
                  {ctaSecondary}
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce-gentle z-20">
          <span className="text-white/40 text-[10px] uppercase tracking-[0.3em] font-semibold"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>Scroll</span>
        </div>
      </ScrollVideo>

      {/* ===== SOCIAL PROOF MARQUEE ===== */}
      <section className="py-10 bg-burgundy overflow-hidden">
        <Marquee speed={30} className="py-2">
          {testimonials.map((quote, i) => (
            <span key={i} className="text-xl md:text-3xl font-bold text-white/90 font-display mx-8 shrink-0 italic">
              &ldquo;{quote}&rdquo;
            </span>
          ))}
        </Marquee>
      </section>

      {/* ===== BEST SELLERS ===== */}
      <section className="py-24 md:py-32 bg-cream">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <p className="stamp text-burgundy mb-6">Best Sellers</p>
              <h2 className="text-section font-fun text-burgundy">
                Your new <AnimatedSquiggly>addiction.</AnimatedSquiggly>
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {bestSellers.map((product, i) => (
              <ScrollReveal key={product.id} delay={i * 0.1}>
                <Link href={`/shop#product-${product.id}`} className="card-bakery overflow-hidden group block">
                  <div className="aspect-video overflow-hidden relative">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.image_alt ?? product.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-warm" />
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-dark font-bold group-hover:text-burgundy transition-colors text-base">
                      {product.name}
                    </h3>
                    <p className="text-gray text-sm mt-1 line-clamp-1">{product.description}</p>
                    <span className="inline-block text-burgundy text-sm font-bold mt-3 group-hover:translate-x-1 transition-transform">
                      View →
                    </span>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== BRAND BREAK — Girl Logo ===== */}
      <section className="py-20 md:py-28 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-10 right-16 w-20 h-20 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-10 left-12 w-14 h-14 rounded-full bg-golden/20 animate-float-reverse" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 flex flex-col items-center text-center">
          <ScrollReveal>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            >
              <Image
                src={brand.squareLogo}
                alt="Bite Me girl icon"
                width={140}
                height={140}
                className="rounded-3xl shadow-lg mb-8"
              />
            </motion.div>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <p className="font-fun text-burgundy text-4xl md:text-6xl">
              Dessert... but make it protein.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== COMPARISON TEASER ===== */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal>
              <p className="stamp text-burgundy mb-6">The Difference</p>
              <h2 className="text-section font-display text-dark mb-6">
                Your protein bar <AnimatedSquiggly>could never.</AnimatedSquiggly>
              </h2>
              <p className="text-body-lg text-gray mb-8">
                Stop settling for chalky, processed protein bars when you could be eating a brownie with 18g of protein.
              </p>
              <Link href="/compare" className="btn-primary">
                See the Breakdown →
              </Link>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <div className="grid grid-cols-2 gap-4">
                <div className="card-bakery p-6">
                  <p className="text-gray text-xs uppercase tracking-widest font-bold mb-4">Typical Bar</p>
                  <div className="space-y-3">
                    {[["Taste", 25], ["Ingredients", 33], ["Freshness", 20]].map(([label, width]) => (
                      <div key={label as string}>
                        <p className="text-gray text-xs mb-1">{label as string}</p>
                        <div className="h-2.5 bg-cream rounded-full">
                          <div className="h-full bg-gray-light/50 rounded-full" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card-bakery p-6 border-2 !border-burgundy/20">
                  <p className="text-burgundy text-xs uppercase tracking-widest font-bold mb-4">Bite Me ✨</p>
                  <div className="space-y-3">
                    {[["Taste", 100], ["Ingredients", 90], ["Freshness", 100]].map(([label, width]) => (
                      <div key={label as string}>
                        <p className="text-dark text-xs mb-1">{label as string}</p>
                        <div className="h-2.5 bg-cream rounded-full">
                          <div className="h-full bg-gradient-to-r from-burgundy to-salmon rounded-full" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ===== BRAND SECTION ===== */}
      <section className="py-24 md:py-32 bg-gradient-warm relative overflow-hidden">
        {/* Floating decorative elements */}
        <div className="absolute top-10 right-10 w-20 h-20 rounded-full bg-salmon/20 animate-float" />
        <div className="absolute bottom-20 left-10 w-16 h-16 rounded-full bg-golden/30 animate-float-reverse" />
        <div className="absolute top-1/2 right-1/4 w-12 h-12 rounded-full bg-burgundy/10 animate-float-slow" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="font-fun text-burgundy text-hero mb-8">
              This isn&apos;t a protein bar.
              <br />
              <span className="text-salmon">It&apos;s a glow up.</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <p className="text-body-lg text-dark/60 max-w-2xl mx-auto">
              We don&apos;t do dry, chalky, or fake. Just real ingredients, high protein,
              and desserts you actually crave. All gluten-free. All low sugar. All no nuts.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== LIFESTYLE PHOTO GRID =====
          Mix of fresh hero shots (AllBitesWide group shot, TeddyBearBites)
          and the original lifestyle backgrounds. Wide aspect-video tiles
          fit the wide-orientation new photos perfectly. */}
      <section className="py-4 bg-cream">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4">
            <ScrollReveal className="aspect-video rounded-2xl overflow-hidden relative shadow-lg">
              <Image src={images.hero.allBitesWide} alt="Every Bite Me bite, lined up" fill className="object-cover hover:scale-105 transition-transform duration-700" />
            </ScrollReveal>
            <ScrollReveal delay={0.1} className="aspect-video rounded-2xl overflow-hidden relative shadow-lg">
              <Image src={images.lifestyle.chocChipHeartBrownies} alt="Heart brownies" fill className="object-cover hover:scale-105 transition-transform duration-700" />
            </ScrollReveal>
            <ScrollReveal delay={0.2} className="aspect-video rounded-2xl overflow-hidden relative shadow-lg">
              <Image src={images.hero.teddyBearBitesWide} alt="Teddy bear shaped bites" fill className="object-cover hover:scale-105 transition-transform duration-700" />
            </ScrollReveal>
            <ScrollReveal delay={0.3} className="aspect-video rounded-2xl overflow-hidden relative shadow-lg">
              <Image src={images.lifestyle.chocTrufflesRed} alt="Chocolate truffles" fill className="object-cover hover:scale-105 transition-transform duration-700" />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ===== VIRAL CALLOUT ===== */}
      <section className="py-20 bg-burgundy">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="font-fun text-white text-hero">
              Be honest&hellip; are you eating it because you like it&hellip;
              <span className="text-golden"> or because you feel like you have to?</span>
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== TRAINER PARTNERSHIP ===== */}
      <section className="py-24 md:py-32 bg-cream">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="card-bakery overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-12 md:p-16">
                <ScrollReveal>
                  <p className="stamp text-burgundy mb-6">Partner With Us</p>
                  <h2 className="text-section font-display text-dark mb-4">
                    For trainers, gyms & studios
                  </h2>
                  <p className="text-body-lg text-gray mb-8">
                    Bulk ordering, exclusive pricing, and your clients will actually love it.
                  </p>
                  <Link href="/trainers" className="btn-primary">
                    Partner With Us
                  </Link>
                </ScrollReveal>
              </div>
              <div className="relative h-64 lg:h-auto">
                <Image src={images.allProducts5} alt="Products" fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/30 to-transparent lg:block hidden" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-24 md:py-32 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-10 left-20 w-24 h-24 rounded-full bg-salmon/20 animate-float" />
        <div className="absolute bottom-10 right-20 w-16 h-16 rounded-full bg-golden/30 animate-float-reverse" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="font-fun text-burgundy text-display mb-6">
              Upgrade your snacks.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <p className="text-body-lg text-dark/60 mb-10">
              Life&apos;s too short for bad protein bars.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <Link href="/shop" className="btn-primary text-lg px-10 py-4">
              Shop Now
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
