import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order confirmed — Bite Me Protein Bakery",
  description: "Thanks for your order!",
  robots: { index: false, follow: false },
};

export default function OrderConfirmationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
