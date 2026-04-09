"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import CartButton from "@/components/shop/CartButton";
import { brand } from "@/lib/brand";

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/compare", label: "Compare" },
  { href: "/quiz", label: "Quiz" },
  { href: "/oven", label: "The Oven" },
  { href: "/about", label: "About" },
  { href: "/events", label: "Events" },
  { href: "/trainers", label: "Trainers" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-burgundy/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo — wide icon+title logo with hover wiggle */}
          <Link href="/" className="shrink-0">
            <motion.div
              whileHover={{ rotate: [0, -2, 2, -1, 0], transition: { duration: 0.5 } }}
              className="relative"
            >
              <Image
                src={brand.squareLogo}
                alt="Bite Me Protein Bakery"
                width={50}
                height={50}
                className="h-12 w-12 object-contain rounded-lg"
                priority
              />
            </motion.div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-7">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-dark/70 hover:text-burgundy transition-colors text-sm font-semibold uppercase tracking-wider"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Cart + CTA + Mobile */}
          <div className="flex items-center gap-3">
            <CartButton />
            <Link href="/shop" className="hidden md:inline-flex btn-primary text-sm py-2.5 px-5">
              Order Now
            </Link>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden text-dark p-2"
              aria-label="Toggle menu"
            >
              <div className="w-6 flex flex-col gap-1.5">
                <motion.span
                  animate={mobileOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                  className="block h-0.5 w-full bg-dark origin-center"
                />
                <motion.span
                  animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
                  className="block h-0.5 w-full bg-dark"
                />
                <motion.span
                  animate={mobileOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                  className="block h-0.5 w-full bg-dark origin-center"
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-t border-burgundy/10 overflow-hidden"
          >
            <div className="px-6 py-8 flex flex-col gap-5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-dark/70 hover:text-burgundy transition-colors text-lg font-semibold uppercase tracking-wider"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/shop"
                onClick={() => setMobileOpen(false)}
                className="btn-primary text-center mt-2"
              >
                Order Now
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
