import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Contact Us | Bite Me Protein Bakery",
  description: "Get in touch with Bite Me Protein Bakery. Call, email, or find us on Instagram.",
};

export default function ContactPage() {
  return (
    <>
      {/* Header */}
      <section className="pt-16 pb-10 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-10 right-16 w-20 h-20 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-8 left-12 w-14 h-14 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-6">Get In Touch</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="font-fun text-burgundy text-5xl md:text-7xl mb-4">
              Let&apos;s <AnimatedSquiggly>talk.</AnimatedSquiggly>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-dark/50 max-w-lg mx-auto">
              Questions, custom orders, partnerships, or just want to say hi? We&apos;d love to hear from you.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-16 bg-cream">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ScrollReveal>
              <a href="tel:9546044127" className="card-bakery p-8 text-center block hover:shadow-lg transition-all">
                <span className="text-4xl mb-4 block">📞</span>
                <h3 className="text-dark font-bold text-lg mb-2">Call Us</h3>
                <p className="text-burgundy font-semibold">(954) 604-4127</p>
              </a>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <a href="mailto:haley@bitemeprotein.com" className="card-bakery p-8 text-center block hover:shadow-lg transition-all">
                <span className="text-4xl mb-4 block">📧</span>
                <h3 className="text-dark font-bold text-lg mb-2">Email</h3>
                <p className="text-burgundy font-semibold text-sm">haley@bitemeprotein.com</p>
              </a>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <a href="https://instagram.com/biteme_protein" target="_blank" rel="noopener noreferrer" className="card-bakery p-8 text-center block hover:shadow-lg transition-all">
                <span className="text-4xl mb-4 block">📸</span>
                <h3 className="text-dark font-bold text-lg mb-2">Instagram</h3>
                <p className="text-burgundy font-semibold">@biteme_protein</p>
              </a>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="card-bakery p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <span className="text-3xl mb-3 block">📍</span>
                <h3 className="font-fun text-burgundy text-2xl mb-2">Our Kitchen</h3>
                <p className="text-dark/60 mb-1">953 E Oakland Park Blvd, Oakland Park, FL 33334</p>
                <p className="text-dark/40 text-sm">Commercial kitchen — all treats baked fresh</p>
              </div>
              <Image src={brand.squareLogo} alt="Bite Me" width={80} height={80} className="rounded-2xl" />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-16 bg-gradient-warm">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="font-fun text-burgundy text-3xl mb-6">Looking for something specific?</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/shop" className="btn-primary">Order Online</Link>
              <Link href="/trainers" className="btn-secondary">Gym Partnerships</Link>
              <Link href="/ambassador" className="btn-secondary">Brand Ambassadors</Link>
              <Link href="/careers" className="btn-secondary">Careers</Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
