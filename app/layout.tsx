import type { Metadata } from "next";
import { DM_Sans, Playfair_Display, Love_Ya_Like_A_Sister, Anton } from "next/font/google";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { CartProvider } from "@/lib/cart";
import CartDrawer from "@/components/shop/CartDrawer";
import "./globals.css";

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const display = Playfair_Display({
  variable: "--font-heading-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const funFont = Love_Ya_Like_A_Sister({
  variable: "--font-love-ya",
  subsets: ["latin"],
  weight: ["400"],
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Bite Me Protein Bakery | Dessert... But Make It Protein",
  description:
    "Soft, fresh, high-protein treats that actually taste like dessert. Protein brownies, banana bread, muffins & more. Not your average protein snack.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} ${funFont.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-dark">
        <CartProvider>
          <Navbar />
          <main className="flex-1 pt-20">{children}</main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
