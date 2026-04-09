import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Oven | Bite Me Protein Bakery",
  description:
    "Click the oven to reveal your perfect Bite Me protein treat. Fun, interactive, and totally random.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
