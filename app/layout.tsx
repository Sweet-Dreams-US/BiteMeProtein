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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "https://bitemeprotein.com";
const SQUARE_LOGO = "https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/BusinessAssets/BiteMeSquareLogo.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Bite Me Protein Bakery | Dessert... But Make It Protein",
  description:
    "Soft, fresh, high-protein treats that actually taste like dessert. Protein brownies, banana bread, muffins & more. Not your average protein snack.",
  // Browser tab + Google favicon — replaces the Next.js default (Vercel circle).
  // Using the square Bite Me logo from Supabase Storage.
  icons: {
    icon: [{ url: SQUARE_LOGO, type: "image/png" }],
    shortcut: [{ url: SQUARE_LOGO, type: "image/png" }],
    apple: [{ url: SQUARE_LOGO, type: "image/png" }],
  },
  // Google Search result thumbnail + social sharing card (Facebook, LinkedIn,
  // iMessage previews, etc.). Google primarily uses og:image for its result
  // snippets on mobile and for some Discover surfaces.
  openGraph: {
    title: "Bite Me Protein Bakery | Dessert... But Make It Protein",
    description:
      "Soft, fresh, high-protein treats that actually taste like dessert. Protein brownies, banana bread, muffins & more.",
    url: SITE_URL,
    siteName: "Bite Me Protein Bakery",
    images: [{ url: SQUARE_LOGO, width: 512, height: 512, alt: "Bite Me Protein Bakery" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Bite Me Protein Bakery",
    description: "Soft, fresh, high-protein treats that actually taste like dessert.",
    images: [SQUARE_LOGO],
  },
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
