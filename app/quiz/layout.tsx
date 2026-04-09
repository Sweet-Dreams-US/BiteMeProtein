import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gym Mood Quiz | Bite Me Protein Bakery",
  description:
    "Find your perfect protein treat. Take our quick quiz and we'll match you with your new addiction.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
