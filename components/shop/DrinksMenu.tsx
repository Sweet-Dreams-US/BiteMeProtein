import ScrollReveal from "@/components/animations/ScrollReveal";

/**
 * Storefront drinks. Static for now — these are in-store only and aren't
 * in the Square catalog yet, so there's nothing to add to a bundle. Once
 * they're in Square with prices, this can pull from /api/square/catalog
 * like the treats do.
 */
const DRINKS = [
  {
    emoji: "🍵",
    name: "Specialty Iced Matcha",
    description: "Creamy iced matcha in fun, rotating flavors — made to pair with your favorite treat.",
  },
  {
    emoji: "🧋",
    name: "Iced Coffees",
    description: "Smooth, cold, and dangerously good. The perfect sidekick to a brownie (or three).",
  },
  {
    emoji: "🥤",
    name: "Smoothies",
    description: "Blended fresh to fuel your workout, your recovery, or just your afternoon.",
  },
];

export default function DrinksMenu({ className = "bg-white" }: { className?: string }) {
  return (
    <section className={`py-20 md:py-24 ${className}`}>
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <p className="stamp text-burgundy mb-6">The Sip Bar</p>
            <h2 className="font-fun text-burgundy text-3xl md:text-5xl mb-3">Something to sip on.</h2>
            <p className="text-dark/50 text-lg max-w-xl mx-auto">
              Pair your treats with a drink made fresh to order.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {DRINKS.map((drink, i) => (
            <ScrollReveal key={drink.name} delay={i * 0.1}>
              <div className="card-bakery p-8 text-center h-full">
                <span className="text-5xl mb-4 block">{drink.emoji}</span>
                <h3 className="font-fun text-burgundy text-2xl mb-2">{drink.name}</h3>
                <p className="text-dark/50">{drink.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.3}>
          <p className="text-center text-burgundy font-bold text-sm mt-10">
            In-store only — pouring at our grand opening. 🎉
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
