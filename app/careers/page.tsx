import type { Metadata } from "next";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";

export const metadata: Metadata = {
  title: "Careers | Bite Me Protein Bakery",
  description:
    "Join the Bite Me team. We're hiring sales reps who love fitness, food, and building something special.",
};

const openRoles = [
  {
    title: "Sales Representative",
    type: "Part-time / $20 per hour",
    location: "Local / Remote",
    description: "Help us get Bite Me into gyms, studios, and retail locations. You'll be the face of the brand in your area — building relationships, closing deals, and spreading the protein gospel.",
    responsibilities: [
      "Identify and approach local gyms, studios, and retailers",
      "Present our products and partnership tiers",
      "Close wholesale and partnership deals",
      "Maintain relationships with existing partners",
      "Hit monthly sales targets",
    ],
    perks: ["Competitive hourly pay", "Free Bite Me products", "Flexible schedule", "Growth potential as we scale"],
  },
];

export default function CareersPage() {
  return (
    <>
      {/* ===== BRANDED TYPOGRAPHY HEADER ===== */}
      <section className="pt-16 pb-10 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-12 left-16 w-20 h-20 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-8 right-12 w-14 h-14 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-6">We're Hiring</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="font-fun text-burgundy text-5xl md:text-7xl mb-4">
              Join the <AnimatedSquiggly>team.</AnimatedSquiggly>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-dark/50 max-w-xl">
              Bite Me is growing and we need passionate people who love fitness, food, and building something special.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Open Roles */}
      <section className="pb-24">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-8">Open Roles</p>
          </ScrollReveal>

          {openRoles.map((role, i) => (
            <ScrollReveal key={role.title} delay={i * 0.1}>
              <div className="card-bakery p-8 md:p-12 mb-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-dark text-2xl font-bold mb-1">{role.title}</h2>
                    <div className="flex flex-wrap gap-3">
                      <span className="bg-burgundy/10 text-burgundy text-xs font-bold px-3 py-1 rounded-full">{role.type}</span>
                      <span className="bg-green/10 text-green text-xs font-bold px-3 py-1 rounded-full">{role.location}</span>
                    </div>
                  </div>
                </div>

                <p className="text-dark/60 mb-6">{role.description}</p>

                <h3 className="text-dark font-bold text-sm uppercase tracking-widest mb-3">What You&apos;ll Do</h3>
                <ul className="space-y-2 mb-6">
                  {role.responsibilities.map((r, j) => (
                    <li key={j} className="flex items-start gap-2 text-dark/60 text-sm">
                      <span className="text-burgundy font-bold mt-0.5">•</span>
                      {r}
                    </li>
                  ))}
                </ul>

                <h3 className="text-dark font-bold text-sm uppercase tracking-widest mb-3">Perks</h3>
                <div className="flex flex-wrap gap-2 mb-8">
                  {role.perks.map((p) => (
                    <span key={p} className="bg-golden-light text-dark text-xs font-bold px-3 py-1.5 rounded-full">{p}</span>
                  ))}
                </div>

                <a href={`mailto:hello@bitemeprotein.com?subject=Application: ${role.title}`}
                  className="btn-primary">
                  Apply for this Role
                </a>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* General CTA */}
      <section className="py-24 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-10 left-16 w-20 h-20 rounded-full bg-salmon/20 animate-float" />
        <div className="absolute bottom-10 right-10 w-14 h-14 rounded-full bg-golden/30 animate-float-reverse" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="font-fun text-burgundy text-section mb-4">
              Don&apos;t see your role?
            </h2>
            <p className="text-dark/60 mb-8 max-w-md mx-auto">
              We&apos;re always looking for talented people. Send us your info and tell us how you&apos;d make Bite Me better.
            </p>
            <a href="mailto:hello@bitemeprotein.com?subject=General Interest"
              className="btn-primary text-lg px-10 py-4">
              Get in Touch
            </a>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
