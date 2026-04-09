import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Menu | Bite Me Protein Bakery",
  description:
    "Fresh-baked protein treats — brownies, muffins, banana bread & truffles. All gluten-free, low sugar, no nuts.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
