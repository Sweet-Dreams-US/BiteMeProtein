"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentCustomer } from "@/lib/customer-auth";
import { supabase } from "@/lib/supabase";

interface AccountOrder {
  id: string;
  shortId: string;
  createdAt: string;
  state: string;
  totalCents: number;
  source: string | null;
  items: Array<{ name: string; quantity: string | number; priceCents?: number | null }>;
  fulfillment: { status: string; tracking_number: string | null; carrier: string | null; shipped_at: string | null } | null;
}

const statusColors: Record<string, string> = {
  new: "bg-[#E3F2FD] text-[#1976D2]",
  preparing: "bg-orange-50 text-orange-500",
  shipped: "bg-purple-50 text-purple-600",
  delivered: "bg-green-50 text-green-600",
  COMPLETED: "bg-green-50 text-green-600",
  OPEN: "bg-[#E3F2FD] text-[#1976D2]",
  CANCELED: "bg-red-50 text-red-500",
};

const statusLabel = (s: string) =>
  ({ new: "Needs fulfillment", preparing: "Preparing", shipped: "Shipped", delivered: "Delivered" })[s] || s;

export default function AccountPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useCurrentCustomer();
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/account/orders", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load orders");
      setOrders(json.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/account/login");
      return;
    }
    fetchOrders();
  }, [authLoading, user, router, fetchOrders]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E8A0BF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null; // redirecting

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-[#5a3e36]">Your account</h1>
          <p className="text-[#7a6a62] text-sm mt-1">Signed in as <strong>{user.email}</strong></p>
          {profile && !profile.square_customer_id && (
            <p className="text-[10px] text-[#b0a098] mt-1 italic">
              We&apos;ll link your account to past orders automatically the next time you order with this email.
            </p>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-[#843430] hover:text-[#6e2a27] font-medium underline underline-offset-4"
        >
          Sign out
        </button>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-[#5a3e36] mb-4">Order history</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-500 text-sm rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#E8A0BF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#f0e6de] p-8 text-center">
            <p className="text-[#5a3e36] font-medium mb-2">No orders yet.</p>
            <p className="text-[#7a6a62] text-sm mb-4">
              Once you place your first order, it&apos;ll show up here with tracking info.
            </p>
            <Link
              href="/shop"
              className="inline-block bg-[#843430] hover:bg-[#6e2a27] text-white font-semibold px-6 py-2.5 rounded-full transition-colors"
            >
              Shop now
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const status = o.fulfillment?.status ?? (o.state === "COMPLETED" ? "new" : (o.state ?? "").toLowerCase());
              return (
                <li key={o.id}>
                  <Link
                    href={`/track?id=${encodeURIComponent(o.id)}&email=${encodeURIComponent(user.email ?? "")}`}
                    className="block bg-white rounded-xl border border-[#f0e6de] p-5 hover:border-[#E8A0BF]/40 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-[#5a3e36] font-mono text-sm font-bold">#{o.shortId}</p>
                        <p className="text-[#b0a098] text-xs mt-0.5">
                          {formatDate(o.createdAt)} · {o.items.length} item{o.items.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#5a3e36] font-bold">{formatPrice(o.totalCents)}</span>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg ${statusColors[status] ?? "bg-[#FFF5EE] text-[#b0a098]"}`}>
                          {statusLabel(status)}
                        </span>
                      </div>
                    </div>
                    {o.items.length > 0 && (
                      <p className="text-[#7a6a62] text-xs mt-2 line-clamp-1">
                        {o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
