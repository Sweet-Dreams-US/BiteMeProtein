import Link from "next/link";

const footerLinks = {
  shop: [
    { href: "/shop", label: "All Products" },
    { href: "/order", label: "Special Orders" },
    { href: "/new", label: "New & Limited Edition" },
    { href: "/compare", label: "Compare" },
    { href: "/quiz", label: "Gym Mood Quiz" },
    { href: "/oven", label: "The Oven" },
    { href: "/reviews", label: "Reviews" },
  ],
  company: [
    { href: "/about", label: "About" },
    { href: "/events", label: "Events" },
    { href: "/trainers", label: "Trainers & Gyms" },
    { href: "/ambassador", label: "Brand Ambassadors" },
    { href: "/careers", label: "Careers" },
    { href: "/contact", label: "Contact Us" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-dark text-cream/80">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <h3 className="font-fun text-salmon text-3xl mb-4">BITE ME</h3>
            <p className="text-cream/50 text-sm leading-relaxed max-w-xs">
              Soft, fresh, high-protein treats that actually taste like dessert.
              Not your average protein snack.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-cream text-xs uppercase tracking-widest font-bold mb-4">Shop</h4>
            <ul className="flex flex-col gap-3">
              {footerLinks.shop.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-cream/50 hover:text-salmon transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-cream text-xs uppercase tracking-widest font-bold mb-4">Company</h4>
            <ul className="flex flex-col gap-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-cream/50 hover:text-salmon transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-cream text-xs uppercase tracking-widest font-bold mb-4">Get in Touch</h4>
            <ul className="flex flex-col gap-3">
              <li>
                <a href="tel:9546044127" className="text-cream/50 hover:text-salmon transition-colors text-sm">
                  (954) 604-4127
                </a>
              </li>
              <li>
                <a href="mailto:haley@bitemeprotein.com" className="text-cream/50 hover:text-salmon transition-colors text-sm">
                  haley@bitemeprotein.com
                </a>
              </li>
              <li>
                <a href="https://instagram.com/biteme_protein" target="_blank" rel="noopener noreferrer" className="text-cream/50 hover:text-salmon transition-colors text-sm">
                  @biteme_protein
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-cream/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-cream/30 text-xs">
            &copy; {new Date().getFullYear()} Bite Me Protein Bakery. All rights reserved.
          </p>
          <p className="text-cream/30 text-xs">
            Built by{" "}
            <a href="https://sweetdreams.us" target="_blank" rel="noopener noreferrer" className="hover:text-salmon transition-colors" style={{ fontFamily: "var(--font-anton)", fontSize: "14px", letterSpacing: "0.05em" }}>
              Sweet Dreams
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
