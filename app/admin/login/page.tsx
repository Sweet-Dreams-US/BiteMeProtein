"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { brand } from "@/lib/brand";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }
    router.push("/admin");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF5EE] px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src={brand.squareLogo} alt="Bite Me" width={60} height={60} className="mx-auto mb-4 rounded-xl" />
          <h1 className="text-2xl font-bold text-[#5a3e36]">Admin Dashboard</h1>
          <p className="text-[#9a8a82] text-sm mt-1">Sign in to manage your store</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-7 shadow-sm border border-[#f0e6de]">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-[#7a6a62] text-sm font-medium mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-[#5a3e36] placeholder:text-[#c4b5aa] focus:border-[#E8A0BF] focus:ring-1 focus:ring-[#E8A0BF] focus:outline-none"
                placeholder="you@email.com" required />
            </div>
            <div>
              <label className="block text-[#7a6a62] text-sm font-medium mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-[#5a3e36] placeholder:text-[#c4b5aa] focus:border-[#E8A0BF] focus:ring-1 focus:ring-[#E8A0BF] focus:outline-none"
                placeholder="••••••••" required />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-[#E8A0BF] text-white py-3 rounded-xl font-semibold mt-6 hover:bg-[#d889ad] transition-colors disabled:opacity-50">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
