"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface RewardTier {
  id: string;
  name: string;
  points: number;
}

interface Program {
  id: string;
  terminology: { one: string; other: string };
  rewardTiers: RewardTier[];
}

export default function AdminLoyaltyPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/loyalty/program");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setEnabled(data.enabled);
      setProgram(data.program || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-[#5a3e36]">Loyalty Program</h2>
          <p className="text-[#b0a098] text-sm">Customer rewards powered by Square Loyalty</p>
        </div>
        <button onClick={load} className="border border-[#e8ddd4] text-[#7a6a62] hover:text-[#5a3e36] px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          Refresh
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-500 text-sm rounded-xl p-3 mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#E8A0BF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !enabled ? (
        /* SETUP STATE — no program yet */
        <div className="bg-white rounded-2xl border border-[#f0e6de] p-8 md:p-12 text-center">
          <span className="text-5xl mb-4 block">⭐</span>
          <h3 className="text-[#5a3e36] text-xl font-bold mb-2">Loyalty not set up yet</h3>
          <p className="text-[#b0a098] text-sm max-w-md mx-auto mb-6">
            You&apos;re on Square Plus — loyalty is ready to activate. Create your program in the Square Seller Dashboard and it&apos;ll automatically plug into this website with zero code changes.
          </p>
          <a
            href="https://squareup.com/dashboard/loyalty"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center bg-[#E8A0BF] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#d889ad] transition-colors"
          >
            Set up in Square Dashboard →
          </a>

          <div className="mt-8 pt-8 border-t border-[#f0e6de] text-left max-w-lg mx-auto">
            <h4 className="text-[#5a3e36] font-bold text-sm mb-3">What you&apos;ll configure in Square:</h4>
            <ol className="space-y-2 text-sm text-[#7a6a62] list-decimal list-inside">
              <li>Earn structure (e.g., 1 point per $1 spent)</li>
              <li>Reward tiers (e.g., 100 pts = free treat, 250 pts = $10 off)</li>
              <li>Program name and point terminology (e.g., &quot;Bite Me Points&quot;)</li>
              <li>Optional launch promotion (e.g., 2x points for first month)</li>
            </ol>
          </div>

          <div className="mt-6 pt-6 border-t border-[#f0e6de]">
            <h4 className="text-[#5a3e36] font-bold text-sm mb-2">Once live:</h4>
            <ul className="space-y-1.5 text-xs text-[#b0a098] text-left max-w-lg mx-auto">
              <li>✅ Customers auto-earn points when they check out (identified by phone)</li>
              <li>✅ Points sync with in-person Square POS purchases</li>
              <li>✅ Balance appears on the customer order tracking page</li>
              <li>✅ No customer sign-up required — Square creates accounts on first purchase</li>
            </ul>
          </div>
        </div>
      ) : program ? (
        /* ACTIVE STATE — program configured */
        <div className="space-y-5">
          {/* Program overview */}
          <div className="bg-white rounded-2xl border border-[#f0e6de] p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">⭐</span>
              <div>
                <h3 className="text-[#5a3e36] font-bold">Program Active</h3>
                <p className="text-[#b0a098] text-xs">
                  Terminology: {program.terminology.one} / {program.terminology.other}
                </p>
              </div>
              <span className="ml-auto bg-green-100 text-green-600 text-xs font-bold px-3 py-1 rounded-full">
                Live
              </span>
            </div>
          </div>

          {/* Reward tiers */}
          <div className="bg-white rounded-2xl border border-[#f0e6de] p-6">
            <h3 className="text-[#5a3e36] font-bold mb-4">Reward Tiers</h3>
            {program.rewardTiers.length === 0 ? (
              <p className="text-[#b0a098] text-sm">
                No reward tiers defined yet — add some in the Square Dashboard.
              </p>
            ) : (
              <div className="space-y-2">
                {program.rewardTiers.map((tier) => (
                  <div key={tier.id} className="flex items-center justify-between bg-[#FFF5EE] rounded-xl p-4">
                    <div>
                      <p className="text-[#5a3e36] font-bold text-sm">{tier.name}</p>
                      <p className="text-[#b0a098] text-xs">Costs {tier.points} {program.terminology.other.toLowerCase()}</p>
                    </div>
                    <span className="font-fun text-burgundy text-xl">{tier.points}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manage in Square */}
          <div className="bg-white rounded-2xl border border-[#f0e6de] p-6 text-center">
            <p className="text-[#7a6a62] text-sm mb-4">
              Edit tiers, change earn rates, or run promotions in Square Dashboard.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <a
                href="https://squareup.com/dashboard/loyalty"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-[#E8A0BF] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#d889ad]"
              >
                Manage Program →
              </a>
              <a
                href="https://squareup.com/dashboard/loyalty/customers"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center border border-[#e8ddd4] text-[#7a6a62] px-5 py-2.5 rounded-xl text-sm font-bold hover:text-[#5a3e36] hover:bg-[#FFF5EE]"
              >
                View Members →
              </a>
            </div>
          </div>

          <Link href="/admin" className="block text-center text-[#b0a098] text-sm hover:text-[#7a6a62] mt-4">
            ← Back to dashboard
          </Link>
        </div>
      ) : null}
    </div>
  );
}
