"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { images } from "@/lib/images";

const treats = [
  {
    name: "Protein Brownies",
    tagline: "Rich, decadent, unapologetic.",
    description: "You crave depth and intensity. These fudgy, chocolatey brownies are dense, gooey, and loaded with ~5g protein per brownie. No holding back.",
    image: images.brownieHearts[0],
    vibe: "You're the go-hard-or-go-home type.",
    cta: "Shop Brownies",
  },
  {
    name: "Blueberry Protein Muffin",
    tagline: "Fresh, light, clean.",
    description: "You appreciate the simple things done well. Fresh blueberries, golden cake, 5g protein per muffin. Bakery-fresh perfection.",
    image: images.blueberryMuffin[0],
    vibe: "You're the early-morning-gym-and-smoothie type.",
    cta: "Shop Muffins",
  },
  {
    name: "Choc Chip Banana Bread",
    tagline: "Warm, comforting, freshly baked.",
    description: "You're all about cozy comfort with a protein punch. Banana, chocolate, vanilla — 18g protein and pure nostalgia.",
    image: images.chocChipBananaBread[0],
    vibe: "You're the cozy-hoodie-and-podcast type.",
    cta: "Shop Banana Bread",
  },
  {
    name: "Cookie Dough Truffles",
    tagline: "Creamy, soft, addictive.",
    description: "You live for the sneaky treats. Smooth vanilla dough, brown sugar, chocolate chips — ~5g protein per truffle and completely plant-based.",
    image: images.chocolateTruffles[0],
    vibe: "You're the ate-cookie-dough-from-the-bowl type.",
    cta: "Shop Truffles",
  },
  {
    name: "Raspberry Banana Bread",
    tagline: "Juicy, indulgent, slightly tart.",
    description: "You like a little twist. Tart raspberries meet rich chocolate in soft banana bread — 18g protein and completely unique.",
    image: images.rasChocChipBananaBread[0],
    vibe: "You're the surprise-me type.",
    cta: "Shop Raspberry",
  },
];

export default function OvenPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [treat, setTreat] = useState(treats[0]);

  const openOven = () => {
    setIsOpen(true);
    // Random treat selection
    const randomTreat = treats[Math.floor(Math.random() * treats.length)];
    setTreat(randomTreat);
    setTimeout(() => setRevealed(true), 1200);
  };

  const reBake = () => {
    setIsOpen(false);
    setRevealed(false);
    setTimeout(openOven, 500);
  };

  return (
    <section className="min-h-screen bg-gradient-warm py-16 relative overflow-hidden">
      {/* Floating decorations */}
      <div className="absolute top-20 right-16 w-24 h-24 rounded-full bg-salmon/20 animate-float" />
      <div className="absolute bottom-32 left-12 w-16 h-16 rounded-full bg-golden/30 animate-float-reverse" />
      <div className="absolute top-1/3 left-1/4 w-10 h-10 rounded-full bg-burgundy/10 animate-float-slow" />

      <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="stamp text-burgundy mb-6">The Oven</p>
          <h1 className="font-fun text-burgundy text-hero mb-4">
            What&apos;s baking for you?
          </h1>
          <p className="text-dark/60 text-lg mb-12 max-w-md mx-auto">
            Click the oven to reveal your perfect Bite Me protein treat. It knows things.
          </p>
        </motion.div>

        {/* THE OVEN */}
        <AnimatePresence mode="wait">
          {!isOpen ? (
            <motion.div
              key="closed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative mx-auto max-w-sm cursor-pointer group"
              onClick={openOven}
            >
              {/* Oven body */}
              <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-dark/10 group-hover:border-burgundy/30 transition-all group-hover:shadow-2xl">
                <div className="bg-dark/5 rounded-2xl h-48 flex items-center justify-center border-2 border-dashed border-dark/10 group-hover:border-burgundy/20 transition-colors">
                  <div className="text-center">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="text-6xl mb-3"
                    >
                      🔥
                    </motion.div>
                    <p className="font-fun text-burgundy text-xl">Tap to open</p>
                  </div>
                </div>
                {/* Oven handle */}
                <div className="mt-4 mx-auto w-24 h-3 bg-dark/20 rounded-full group-hover:bg-burgundy/40 transition-colors" />
              </div>
              {/* Steam animation */}
              <motion.div
                animate={{ y: [-5, -15, -5], opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="absolute -top-4 left-1/2 -translate-x-1/2 text-3xl"
              >
                ♨️
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ opacity: 0, scale: 0.8, rotateX: -30 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0 }}
              transition={{ duration: 0.6, ease: "backOut" }}
              className="max-w-md mx-auto"
            >
              {!revealed ? (
                /* Loading / Baking animation */
                <div className="bg-white rounded-3xl p-12 shadow-xl">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="text-6xl mx-auto w-fit mb-4"
                  >
                    🍪
                  </motion.div>
                  <p className="font-fun text-burgundy text-xl">Baking your treat...</p>
                </div>
              ) : (
                /* Revealed treat */
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="card-bakery overflow-hidden text-left"
                >
                  <div className="aspect-video relative overflow-hidden">
                    <Image src={treat.image} alt={treat.name} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark/50 to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <p className="text-white/80 text-sm font-bold">Your treat is ready!</p>
                    </div>
                  </div>
                  <div className="p-8">
                    <h2 className="font-fun text-burgundy text-2xl mb-1">{treat.name}</h2>
                    <p className="text-salmon font-bold italic mb-4">{treat.tagline}</p>
                    <p className="text-dark/60 mb-3">{treat.description}</p>
                    <p className="text-dark/40 text-sm italic mb-6">{treat.vibe}</p>
                    <div className="flex gap-3">
                      <Link href="/shop" className="btn-primary flex-1 text-center">{treat.cta}</Link>
                      <button onClick={reBake} className="btn-secondary flex-1">
                        Re-bake 🔄
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
