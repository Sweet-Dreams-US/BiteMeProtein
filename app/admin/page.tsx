"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-fetch";
import Link from "next/link";

interface Stats {
  squareProducts: number;
  enrichedProducts: number;
  activeEvents: number;
  recentOrders: number;
  squareConnected: boolean;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    squareProducts: 0,
    enrichedProducts: 0,
    activeEvents: 0,
    recentOrders: 0,
    squareConnected: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      // Fetch Square products
      let squareProducts = 0;
      let squareConnected = false;
      let recentOrders = 0;
      try {
        const catalogRes = await adminFetch("/api/square/catalog");
        const catalogData = await catalogRes.json();
        if (!catalogData.error) {
          squareProducts = catalogData.items?.length || 0;
          squareConnected = true;
        }
      } catch { /* Square not connected */ }

      try {
        const ordersRes = await adminFetch("/api/square/orders");
        const ordersData = await ordersRes.json();
        if (!ordersData.error) {
          recentOrders = ordersData.orders?.length || 0;
        }
      } catch { /* ignore */ }

      // Fetch Supabase stats
      const [enrichedRes, eventsRes] = await Promise.all([
        supabase.from("product_enrichments").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);

      setStats({
        squareProducts,
        enrichedProducts: enrichedRes.count || 0,
        activeEvents: eventsRes.count || 0,
        recentOrders,
        squareConnected,
      });
      setLoading(false);
    };

    fetchStats();
  }, []);

  const cards = [
    { label: "Square Products", value: stats.squareProducts, href: "/admin/products", border: "border-l-[#E8A0BF]" },
    { label: "Enriched", value: stats.enrichedProducts, href: "/admin/products", border: "border-l-[#1976D2]" },
    { label: "Active Events", value: stats.activeEvents, href: "/admin/events", border: "border-l-orange-400" },
    { label: "Orders (30d)", value: stats.recentOrders, href: "/admin/orders", border: "border-l-green-500" },
  ];

  const quickActions = [
    { label: "Manage Products", description: "Create, edit, and enrich products. All changes sync to Square POS.", href: "/admin/products" },
    { label: "Manage Events", description: "Add, edit, or remove upcoming events and pop-ups", href: "/admin/events" },
    { label: "Edit Site Content", description: "Update homepage hero, announcements, about page, and trainer section", href: "/admin/content" },
    { label: "View Orders", description: "See recent orders from website and in-person Square POS", href: "/admin/orders" },
  ];

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[#5a3e36] mb-2">Welcome back</h2>
        <p className="text-[#b0a098]">Here&apos;s what&apos;s happening with your store.</p>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-10">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-[#f0e6de] animate-pulse">
              <div className="h-4 w-20 bg-[#f0e6de] rounded mb-2" />
              <div className="h-8 w-12 bg-[#f0e6de] rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`bg-white rounded-2xl p-6 border border-[#f0e6de] border-l-4 ${card.border} shadow-sm hover:shadow-md transition-shadow`}
            >
              <p className="text-[#b0a098] text-sm mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-[#5a3e36]">
                {card.value}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* Square Status */}
      <div className="bg-white rounded-2xl p-6 border border-[#f0e6de] shadow-sm mb-10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[#5a3e36] font-semibold mb-1">Square Integration</h3>
            <p className="text-[#b0a098] text-sm">
              Products, inventory, and orders sync in real-time with your Square POS.
            </p>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl ${
            stats.squareConnected
              ? "bg-green-50 text-green-600"
              : "bg-orange-50 text-orange-500"
          }`}>
            <span className={`w-2 h-2 rounded-full ${stats.squareConnected ? "bg-green-500" : "bg-orange-400"}`} />
            {stats.squareConnected ? "Connected" : "Pending"}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <h3 className="text-[#5a3e36] font-semibold mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="bg-white rounded-2xl p-6 border border-[#f0e6de] shadow-sm hover:shadow-md transition-all group"
          >
            <h4 className="text-[#5a3e36] font-semibold group-hover:text-[#E8A0BF] transition-colors mb-1">
              {action.label}
            </h4>
            <p className="text-[#b0a098] text-sm">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
