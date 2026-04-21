import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout — Bite Me Protein Bakery",
  description: "Finalize your high-protein bakery order.",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
