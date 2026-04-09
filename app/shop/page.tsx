"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useCart, BundleTier } from "@/lib/cart";
import { images } from "@/lib/images";
import { brand } from "@/lib/brand";
import { supabase } from "@/lib/supabase";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";

interface Variation {
  id: string;
  name: string;
  priceMoney: { amount: number; currency: string } | null;
  trackInventory: boolean;
  inventoryCount: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  variations: Variation[];
}

interface Enrichment {
  square_catalog_id: string;
  extended_description: string | null;
  ingredients: string | null;
  nutrition_info: string | null;
  badges: string[];
  website_category: string | null;
  is_visible: boolean;
  sort_order: number;
}

const productShowcase: Record<string, {
  photos: readonly string[];
  nutritionImage: string;
  flavorNotes: string;
  feel: string;
  emoji: string;
  bestFor: string[];
}> = {
  "Chocolate Chip Protein Banana Bread Bites": {
    photos: [...images.chocChipBananaBread, images.lifestyle.chocChipBananaBread],
    nutritionImage: images.nutrition.chocChipBananaBread,
    flavorNotes: "Warm banana · Melted chocolate · Sweet vanilla",
    feel: "warm, comforting, freshly baked",
    emoji: "🍌",
    bestFor: ["Post-workout refuel", "Morning coffee companion", "On-the-go breakfast"],
  },
  "Raspberry Chocolate Chip Protein Banana Bread Bites": {
    photos: [...images.rasChocChipBananaBread, ...images.lifestyle.chocChipRaspberryRed],
    nutritionImage: images.nutrition.raspberryBananaBread,
    flavorNotes: "Juicy raspberry · Melted chocolate · Sweet banana",
    feel: "juicy, indulgent, slightly tart",
    emoji: "🍓",
    bestFor: ["Afternoon pick-me-up", "Sweet craving fix", "Pre-workout fuel"],
  },
  "Blueberry Protein Muffin": {
    photos: [...images.blueberryMuffin, ...images.lifestyle.blueberryMuffinPurple],
    nutritionImage: images.nutrition.blueberryMuffin,
    flavorNotes: "Fresh blueberries · Light vanilla · Golden cake",
    feel: "fresh, light, clean",
    emoji: "🫐",
    bestFor: ["Morning breakfast", "Coffee pairing", "Clean snack break"],
  },
  "Protein Brownies": {
    photos: [...images.brownieHearts, images.lifestyle.chocChipHeartBrownies, images.allChocProducts1, images.allChocProducts2],
    nutritionImage: images.nutrition.brownie,
    flavorNotes: "Deep cocoa · Melted chocolate · Rich brownie",
    feel: "rich, decadent, chocolatey",
    emoji: "🍫",
    bestFor: ["Post-workout treat", "Late night craving", "Dessert replacement"],
  },
  "Protein Vegan Cookie Dough Truffles": {
    photos: [...images.chocolateTruffles, images.lifestyle.chocTrufflesRed, images.allChocProducts1],
    nutritionImage: images.nutrition.cookieDoughTruffle,
    flavorNotes: "Sweet vanilla dough · Maple syrup · Chocolate chips",
    feel: "creamy, soft, addictive",
    emoji: "🍪",
    bestFor: ["Sharing with friends", "Movie night snack", "Sweet tooth fix"],
  },
};

export default function ShopPage() {
  return (
    <Suspense>
      <ShopContent />
    </Suspense>
  );
}

function ShopContent() {
  const { addBundle, addItemToBundle, removeItemFromBundle, bundles, addItem, setIsOpen } = useCart();
  const searchParams = useSearchParams();
  const orderSuccess = searchParams.get("order") === "success";

  const [products, setProducts] = useState<Product[]>([]);
  const [enrichments, setEnrichments] = useState<Record<string, Enrichment>>({});
  const [bundleTiers, setBundleTiers] = useState<BundleTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<BundleTier | null>(null);
  const [activeBundleIndex, setActiveBundleIndex] = useState<number | null>(null);
  const [showNutrition, setShowNutrition] = useState<string | null>(null);
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [catalogRes, enrichRes, tiersRes] = await Promise.all([
      fetch("/api/square/catalog"),
      supabase.from("product_enrichments").select("*"),
      supabase.from("bundle_tiers").select("*").eq("is_active", true).order("sort_order"),
    ]);
    const catalogData = await catalogRes.json();
    if (catalogData.items) setProducts(catalogData.items);
    if (enrichRes.data) {
      const map: Record<string, Enrichment> = {};
      enrichRes.data.forEach((e: Enrichment) => { map[e.square_catalog_id] = e; });
      setEnrichments(map);
    }
    if (tiersRes.data) setBundleTiers(tiersRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const showcaseProducts = products
    .filter((p) => productShowcase[p.name])
    .filter((p) => { const e = enrichments[p.id]; return !e || e.is_visible !== false; })
    .sort((a, b) => (enrichments[a.id]?.sort_order ?? 999) - (enrichments[b.id]?.sort_order ?? 999));

  // Track the next bundle index via ref to avoid stale closure
  const nextBundleIndex = bundles.length;

  const handleStartBundle = (tier: BundleTier) => {
    const idx = nextBundleIndex;
    addBundle(tier);
    setSelectedTier(tier);
    setActiveBundleIndex(idx);
  };

  const handleAddToBundle = (product: Product) => {
    if (activeBundleIndex === null) return;
    const v = product.variations[0];
    if (!v) return;
    addItemToBundle(activeBundleIndex, {
      productId: product.id,
      variationId: v.id,
      name: product.name,
      variationName: v.name || "",
      price: v.priceMoney?.amount || 0,
    });
    setAddedFeedback(product.id);
    setTimeout(() => setAddedFeedback(null), 800);

    // Check if bundle is now full
    const bundle = bundles[activeBundleIndex];
    if (bundle) {
      const count = bundle.items.reduce((s, i) => s + i.quantity, 0) + 1;
      if (count >= (selectedTier?.item_count || 0)) {
        // Bundle is full — open cart
        setTimeout(() => setIsOpen(true), 500);
      }
    }
  };

  const handleAddIndividual = (product: Product) => {
    const v = product.variations[0];
    if (!v?.priceMoney) return;
    addItem({
      productId: product.id,
      variationId: v.id,
      name: product.name,
      variationName: v.name || "",
      price: v.priceMoney.amount,
    });
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const currentBundleCount = activeBundleIndex !== null && bundles[activeBundleIndex]
    ? bundles[activeBundleIndex].items.reduce((s, i) => s + i.quantity, 0)
    : 0;

  const getProductCountInBundle = (variationId: string) => {
    if (activeBundleIndex === null || !bundles[activeBundleIndex]) return 0;
    const item = bundles[activeBundleIndex].items.find((i) => i.variationId === variationId);
    return item?.quantity || 0;
  };

  const handleRemoveFromBundle = (variationId: string) => {
    if (activeBundleIndex === null) return;
    removeItemFromBundle(activeBundleIndex, variationId);
  };

  return (
    <>
      {/* Order Success */}
      <AnimatePresence>
        {orderSuccess && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-green-50 border-b border-green-200 px-6 py-4 text-center">
            <p className="text-green-600 font-bold">Order placed successfully! Thank you! 🎉</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== HEADER ===== */}
      <section className="pt-16 pb-6 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-8 right-16 w-24 h-24 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-8 left-12 w-16 h-16 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Image src={brand.squareLogo} alt="Bite Me" width={60} height={60} className="mx-auto mb-5 rounded-2xl" />
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="font-fun text-burgundy text-5xl md:text-7xl mb-3">
            Build Your <AnimatedSquiggly>Box</AnimatedSquiggly>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-dark/50 text-lg max-w-md mx-auto">
            Pick a size, fill it with your favorites, and we&apos;ll ship it fresh.
          </motion.p>
        </div>
      </section>

      {loading ? (
        <section className="py-20 flex justify-center">
          <div className="w-10 h-10 border-3 border-[#E8A0BF] border-t-transparent rounded-full animate-spin" />
        </section>
      ) : (
        <>
          {/* ===== STEP 1: PICK YOUR BOX ===== */}
          <section className="py-16 bg-cream">
            <div className="max-w-4xl mx-auto px-6 lg:px-8">
              <ScrollReveal>
                <div className="text-center mb-10">
                  <p className="stamp text-burgundy mb-4">Step 1</p>
                  <h2 className="font-fun text-burgundy text-3xl md:text-4xl">Pick your box size</h2>
                </div>
              </ScrollReveal>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {bundleTiers.map((tier, i) => (
                  <ScrollReveal key={tier.id} delay={i * 0.1}>
                    <motion.button
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleStartBundle(tier)}
                      className={`w-full text-left card-bakery p-6 relative overflow-hidden transition-all ${
                        selectedTier?.id === tier.id ? "ring-2 ring-[#E8A0BF] shadow-lg" : "hover:shadow-md"
                      } ${tier.shipping_eligible ? "border-2 border-green-300" : ""}`}
                    >
                      {tier.shipping_eligible && (
                        <span className="absolute top-3 right-3 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Ships ✓
                        </span>
                      )}
                      {tier.pickup_only && (
                        <span className="absolute top-3 right-3 bg-orange-50 text-orange-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Pickup only
                        </span>
                      )}
                      <div className="text-4xl mb-3">📦</div>
                      <h3 className="font-fun text-burgundy text-2xl mb-1">{tier.name}</h3>
                      <p className="text-dark/50 text-sm mb-3">Pick any {tier.item_count} treats</p>
                      <p className="text-burgundy text-2xl font-bold">{formatPrice(tier.price_cents)}</p>
                      <p className="text-dark/30 text-xs mt-1">
                        {formatPrice(Math.round(tier.price_cents / tier.item_count))} per treat
                      </p>
                      {tier.shipping_eligible && tier.shipping_cost_cents ? (
                        <p className="text-green-600 text-xs font-semibold mt-2">
                          🧊 Cold pack shipping: +{formatPrice(tier.shipping_cost_cents)}
                        </p>
                      ) : null}
                    </motion.button>
                  </ScrollReveal>
                ))}
              </div>

              {/* Individual pickup option */}
              <ScrollReveal delay={0.3}>
                <p className="text-center text-dark/30 text-sm mt-6">
                  Picking up in person? You can also add individual items below.
                </p>
              </ScrollReveal>
            </div>
          </section>

          {/* ===== ACTIVE BUNDLE PROGRESS ===== */}
          <AnimatePresence>
            {selectedTier && activeBundleIndex !== null && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-[#FCE4EC] border-y border-[#E8A0BF]/20 overflow-hidden"
              >
                <div className="max-w-4xl mx-auto px-6 lg:px-8 py-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-[#c2185b] font-bold text-sm">
                        Building your {selectedTier.name}
                      </h3>
                      <p className="text-[#c2185b]/60 text-xs">
                        {currentBundleCount}/{selectedTier.item_count} treats selected
                      </p>
                    </div>
                    <button onClick={() => setIsOpen(true)} className="bg-[#E8A0BF] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#d889ad]">
                      {currentBundleCount >= selectedTier.item_count ? "View Cart ✓" : `${selectedTier.item_count - currentBundleCount} more`}
                    </button>
                  </div>
                  <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#E8A0BF] rounded-full"
                      animate={{ width: `${(currentBundleCount / selectedTier.item_count) * 100}%` }}
                      transition={{ duration: 0.4, type: "spring" }}
                    />
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* ===== STEP 2: CHOOSE YOUR TREATS ===== */}
          <section className="py-16 bg-white">
            <div className="max-w-5xl mx-auto px-6 lg:px-8">
              <ScrollReveal>
                <div className="text-center mb-12">
                  <p className="stamp text-burgundy mb-4">Step 2</p>
                  <h2 className="font-fun text-burgundy text-3xl md:text-4xl">
                    Choose your <AnimatedSquiggly>treats</AnimatedSquiggly>
                  </h2>
                </div>
              </ScrollReveal>

              <div className="space-y-8">
                {showcaseProducts.map((product, i) => {
                  const showcase = productShowcase[product.name];
                  const enrichment = enrichments[product.id];
                  if (!showcase) return null;
                  const isEven = i % 2 === 0;

                  return (
                    <ScrollReveal key={product.id}>
                      <div className={`card-bakery overflow-hidden`}>
                        <div className={`flex flex-col md:flex-row ${!isEven ? "md:flex-row-reverse" : ""}`}>
                          {/* Photo */}
                          <div className="md:w-2/5 relative" style={{ minHeight: "220px" }}>
                            <Image
                              src={showcase.photos[0]}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          </div>

                          {/* Info */}
                          <div className="md:w-3/5 p-6 md:p-8 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">{showcase.emoji}</span>
                              <h3 className="font-fun text-burgundy text-2xl md:text-3xl">{product.name}</h3>
                            </div>

                            <p className="text-dark/40 text-xs font-bold uppercase tracking-wider mb-3">{showcase.flavorNotes}</p>
                            <p className="text-dark/60 text-sm mb-4 leading-relaxed">
                              {enrichment?.extended_description || product.description}
                            </p>

                            <div className="flex flex-wrap gap-1.5 mb-4">
                              {(enrichment?.ingredients || "Gluten-free · Low sugar · No nuts").split("·").map((d) => (
                                <span key={d.trim()} className="bg-cream-dark/40 text-dark/50 text-xs font-semibold px-3 py-1 rounded-full">{d.trim()}</span>
                              ))}
                              <span className="bg-cream-dark/40 text-dark/50 text-xs font-semibold px-3 py-1 rounded-full">Kosher certified</span>
                              {enrichment?.nutrition_info && (
                                <span className="bg-burgundy/10 text-burgundy text-xs font-bold px-3 py-1 rounded-full">{enrichment.nutrition_info}</span>
                              )}
                            </div>

                            {/* Best paired with */}
                            <div className="mb-5">
                              <p className="text-dark/30 text-xs font-bold uppercase tracking-wider mb-2">Best for</p>
                              <div className="flex flex-wrap gap-1.5">
                                {showcase.bestFor.map((use) => (
                                  <span key={use} className="bg-burgundy/8 text-burgundy/70 text-xs font-semibold px-3 py-1.5 rounded-full">
                                    {use}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex gap-2 items-stretch">
                              {/* Add to bundle with quantity controls */}
                              {activeBundleIndex !== null && selectedTier ? (
                                (() => {
                                  const v = product.variations[0];
                                  const count = v ? getProductCountInBundle(v.id) : 0;
                                  const bundleFull = currentBundleCount >= selectedTier.item_count;

                                  if (count === 0) {
                                    return (
                                      <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleAddToBundle(product)}
                                        disabled={bundleFull}
                                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                                          bundleFull
                                            ? "bg-cream-dark text-dark/30 cursor-not-allowed"
                                            : "bg-[#E8A0BF] text-white hover:bg-[#d889ad]"
                                        }`}
                                      >
                                        {bundleFull ? "Box is full" : `+ Add to ${selectedTier.name}`}
                                      </motion.button>
                                    );
                                  }

                                  return (
                                    <div className="flex-1 flex items-center justify-between bg-[#E8A0BF] rounded-xl p-1.5">
                                      <button
                                        onClick={() => v && handleRemoveFromBundle(v.id)}
                                        className="w-10 h-10 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xl font-bold flex items-center justify-center transition-colors"
                                      >
                                        −
                                      </button>
                                      <div className="text-center">
                                        <p className="text-white font-bold text-lg leading-none">{count}</p>
                                        <p className="text-white/70 text-[9px] uppercase tracking-wider">In box</p>
                                      </div>
                                      <button
                                        onClick={() => handleAddToBundle(product)}
                                        disabled={bundleFull}
                                        className={`w-10 h-10 rounded-lg text-xl font-bold flex items-center justify-center transition-colors ${
                                          bundleFull
                                            ? "bg-white/10 text-white/40 cursor-not-allowed"
                                            : "bg-white/20 hover:bg-white/30 text-white"
                                        }`}
                                      >
                                        +
                                      </button>
                                    </div>
                                  );
                                })()
                              ) : (
                                <button
                                  onClick={() => handleAddIndividual(product)}
                                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-[#FFF5EE] text-[#7a6a62] border border-[#e8ddd4] hover:bg-[#E8A0BF] hover:text-white hover:border-[#E8A0BF] transition-all"
                                >
                                  Add Individual
                                </button>
                              )}

                              {/* Nutrition toggle */}
                              <button
                                onClick={() => setShowNutrition(showNutrition === product.id ? null : product.id)}
                                className="px-4 py-3 rounded-xl text-sm font-bold bg-[#FFF5EE] text-[#7a6a62] border border-[#e8ddd4] hover:border-[#1976D2] hover:text-[#1976D2] transition-all shrink-0"
                              >
                                {showNutrition === product.id ? "Close" : "Nutrition"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Nutrition slide-out */}
                      <AnimatePresence>
                        {showNutrition === product.id && (
                          <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" onClick={() => setShowNutrition(null)} />
                            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                              transition={{ type: "spring", damping: 25, stiffness: 200 }}
                              className="fixed right-0 top-0 bottom-0 w-80 bg-white z-50 shadow-2xl flex flex-col">
                              <div className="flex items-center justify-between p-5 border-b border-[#f0e6de]">
                                <h3 className="font-bold text-[#5a3e36] text-sm">Nutrition Facts</h3>
                                <button onClick={() => setShowNutrition(null)} className="w-7 h-7 rounded-full bg-[#FFF5EE] flex items-center justify-center text-[#b0a098] text-xs">✕</button>
                              </div>
                              <div className="flex-1 overflow-y-auto p-5">
                                <Image src={showcase.nutritionImage} alt="Nutrition facts" width={280} height={400} className="w-full h-auto rounded-xl" />
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </ScrollReveal>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ===== NO BUNDLE SELECTED PROMPT ===== */}
          {activeBundleIndex === null && (
            <section className="py-16 bg-gradient-warm">
              <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
                <ScrollReveal>
                  <p className="font-fun text-burgundy text-3xl md:text-4xl mb-4">Ready to order?</p>
                  <p className="text-dark/50 mb-6">Pick a box size above, then come back here to fill it with treats.</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/quiz" className="btn-secondary">Not sure? Take the Quiz</Link>
                    <Link href="/oven" className="btn-secondary">Try the Oven 🔥</Link>
                  </div>
                </ScrollReveal>
              </div>
            </section>
          )}

          {/* ===== SPECIAL ORDERS ===== */}
          <section className="py-20 bg-white">
            <div className="max-w-4xl mx-auto px-6 lg:px-8">
              <ScrollReveal>
                <div className="card-bakery p-8 md:p-12 text-center">
                  <span className="text-4xl mb-4 block">🎂</span>
                  <h2 className="font-fun text-burgundy text-3xl md:text-4xl mb-3">Special Orders</h2>
                  <p className="text-dark/50 text-lg mb-6 max-w-lg mx-auto">
                    Birthday cakes, bear size treats, custom flavors, and large event orders. Tell us what you need and we&apos;ll make it happen.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/order" className="btn-primary">Place a Special Order</Link>
                    <Link href="/contact" className="btn-secondary">Contact Us</Link>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>
        </>
      )}
    </>
  );
}
