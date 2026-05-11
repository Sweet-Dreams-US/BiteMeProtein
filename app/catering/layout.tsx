import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catering | Bite Me Protein Bakery",
  description:
    "Catering packages for offices, events, and gym communities. Small, Medium, and Large tiers — every treat baked fresh, every order tailored.",
};

export default function CateringLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
