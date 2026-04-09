import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Breakdown | Bite Me Protein Bakery",
  description:
    "See how Bite Me protein treats compare to typical protein bars. More protein, less sugar, zero artificial ingredients.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
