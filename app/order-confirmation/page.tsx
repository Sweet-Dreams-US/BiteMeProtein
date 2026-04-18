"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order") || "";
  const email = searchParams.get("email") || "";
  const shortId = orderId.slice(-6).toUpperCase();

  return (
    <div className="bg-gradient-warm min-h-screen py-16 relative overflow-hidden">
      <div className="absolute top-20 right-16 w-24 h-24 rounded-full bg-salmon/15 animate-float" />
      <div className="absolute bottom-16 left-12 w-20 h-20 rounded-full bg-golden/20 animate-float-reverse" />

      <div className="relative max-w-2xl mx-auto px-6 lg:px-8">
        <ScrollReveal>
          <div className="card-bakery p-8 md:p-12 text-center">
            <div className="text-7xl mb-6 animate-bounce-gentle">🎉</div>
            <p className="stamp text-burgundy mb-6 inline-block">Order Confirmed</p>

            <h1 className="font-fun text-burgundy text-4xl md:text-5xl mb-4">
              Thank <AnimatedSquiggly>you!</AnimatedSquiggly>
            </h1>

            <p className="text-dark/60 text-lg mb-2">
              We got your order and we&apos;re on it.
            </p>

            {shortId && (
              <p className="text-dark/40 text-sm mb-8">
                Order reference: <span className="font-mono font-bold text-burgundy">#{shortId}</span>
              </p>
            )}

            <div className="bg-[#FFF5EE] rounded-2xl p-6 mb-6 text-left space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-xl">📧</span>
                <div>
                  <p className="text-dark font-bold text-sm">Confirmation email on the way</p>
                  <p className="text-dark/50 text-xs">Check your inbox — Square sends a receipt to {email || "your email"} within a few minutes.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">🔥</span>
                <div>
                  <p className="text-dark font-bold text-sm">Haley is baking</p>
                  <p className="text-dark/50 text-xs">Small-batch fresh — usually out the kitchen within 1-2 business days.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">📦</span>
                <div>
                  <p className="text-dark font-bold text-sm">Tracking info coming</p>
                  <p className="text-dark/50 text-xs">Once we ship, your tracking number will show up on the order status page below.</p>
                </div>
              </div>
            </div>

            {orderId && email && (
              <Link
                href={`/track?id=${encodeURIComponent(shortId)}&email=${encodeURIComponent(email)}`}
                className="btn-primary w-full block mb-3"
              >
                Track Your Order →
              </Link>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Link href="/shop" className="flex-1 border-2 border-burgundy text-burgundy px-6 py-3 rounded-full font-bold hover:bg-burgundy hover:text-white transition-colors">
                Keep Shopping
              </Link>
              <a
                href="https://instagram.com/biteme_protein"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-[#FFF5EE] border border-[#e8ddd4] text-[#7a6a62] px-6 py-3 rounded-full font-bold hover:bg-white transition-colors"
              >
                Follow @biteme_protein
              </a>
            </div>

            <p className="text-dark/40 text-xs mt-6">
              Questions? Email <a href="mailto:haley@bitemeprotein.com" className="text-burgundy hover:underline">haley@bitemeprotein.com</a>
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense>
      <ConfirmationContent />
    </Suspense>
  );
}
