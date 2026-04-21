import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your account — Bite Me Protein Bakery",
  description: "Your order history and rewards.",
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
