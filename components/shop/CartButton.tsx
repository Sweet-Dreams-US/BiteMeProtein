"use client";

import { useCart } from "@/lib/cart";
import { motion, AnimatePresence } from "framer-motion";

export default function CartButton() {
  const { totalItems, bundles, setIsOpen } = useCart();
  const count = totalItems + bundles.filter((b) => b.items.reduce((s, i) => s + i.quantity, 0) < b.tier.item_count).length;

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="relative p-2 text-[#5a3e36] hover:text-[#E8A0BF] transition-colors"
      aria-label="Open cart"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
      <AnimatePresence>
        {(totalItems > 0 || bundles.length > 0) && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-[#E8A0BF] text-white text-xs font-bold rounded-full flex items-center justify-center"
          >
            {count || totalItems}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
