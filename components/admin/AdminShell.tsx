"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { brand } from "@/lib/brand";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/products", label: "Products", icon: "🧁" },
  { href: "/admin/product-images", label: "Images", icon: "📸" },
  { href: "/admin/bundles", label: "Bundles", icon: "📦" },
  { href: "/admin/events", label: "Events", icon: "📅" },
  { href: "/admin/orders", label: "Orders", icon: "🧾" },
  { href: "/admin/pickup-schedule", label: "Pickup Hours", icon: "🕐" },
  { href: "/admin/loyalty", label: "Loyalty", icon: "⭐" },
  { href: "/admin/discounts", label: "Discounts", icon: "🎟️" },
  { href: "/admin/accounting", label: "Accounting", icon: "💰" },
  { href: "/admin/errors", label: "Errors", icon: "🚨" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) { setLoading(false); return; }
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push("/admin/login");
      else setLoading(false);
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.push("/admin/login");
    });
    return () => subscription.unsubscribe();
  }, [router, isLoginPage]);

  if (isLoginPage) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF5EE] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E8A0BF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF5EE] flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-[#f0e6de] shadow-sm transform transition-transform lg:translate-x-0 lg:static ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex flex-col h-full">
          <div className="p-5 border-b border-[#f0e6de]">
            <div className="flex items-center gap-3">
              <Image src={brand.squareLogo} alt="Bite Me" width={36} height={36} className="rounded-lg" />
              <div>
                <p className="text-[#5a3e36] font-bold text-sm">Bite Me</p>
                <p className="text-[#b0a098] text-xs">Admin</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive ? "bg-[#FCE4EC] text-[#c2185b]" : "text-[#7a6a62] hover:bg-[#FFF5EE] hover:text-[#5a3e36]"
                  }`}>
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-[#f0e6de] space-y-1">
            <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#b0a098] hover:text-[#5a3e36] hover:bg-[#FFF5EE] transition-colors">
              ← View Site
            </Link>
            <button onClick={async () => { await supabase.auth.signOut(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#b0a098] hover:text-red-500 hover:bg-red-50 transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#f0e6de] px-5 py-3 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-[#7a6a62] p-1">
            <div className="w-5 flex flex-col gap-1">
              <span className="block h-0.5 w-full bg-[#7a6a62]" />
              <span className="block h-0.5 w-full bg-[#7a6a62]" />
              <span className="block h-0.5 w-full bg-[#7a6a62]" />
            </div>
          </button>
          <h1 className="text-[#5a3e36] font-semibold text-sm">
            {navItems.find((n) => n.href === pathname)?.label || "Admin"}
          </h1>
        </header>
        <main className="flex-1 p-5 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
