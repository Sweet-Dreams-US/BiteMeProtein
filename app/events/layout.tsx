import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Events | Bite Me Protein Bakery",
  description:
    "Find us at pop-ups, markets, and gym partnerships. Come get a bite in person.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
