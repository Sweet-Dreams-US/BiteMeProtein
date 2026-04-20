"use client";

import { useState } from "react";
import Link from "next/link";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";

interface RewardTier {
  id: string;
  name: string;
  points: number;
}

interface FoundResult {
  found: true;
  phone: string;
  email: string | null;
  points: number;
  lifetimePoints: number;
  terminology?: { one?: string; other?: string };
  rewardTiers: RewardTier[];
  featuredDeals: Array<{ title?: string; description?: string } | string>;
}

interface NotFoundResult {
  found: false;
  reason: string;
}

type LookupResult = FoundResult | NotFoundResult;

export default function RewardsPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);

  // Email-copy state
  const [emailInput, setEmailInput] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ sent: boolean; reason?: string } | null>(null);

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    setEmailResult(null);
    try {
      const res = await fetch("/api/rewards/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data: LookupResult = await res.json();
      setResult(data);
      if (data.found && data.email) setEmailInput(data.email);
    } catch {
      setResult({ found: false, reason: "Something went wrong. Try again." });
    }
    setLoading(false);
  };

  const sendEmail = async () => {
    if (!result?.found) return;
    if (!emailInput.trim()) {
      setEmailResult({ sent: false, reason: "Enter an email first." });
      return;
    }
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/rewards/email-copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: emailInput.trim(),
          points: result.points,
          lifetimePoints: result.lifetimePoints,
          terminology: result.terminology,
          rewardTiers: result.rewardTiers,
          featuredDeals: result.featuredDeals,
        }),
      });
      const json = await res.json();
      setEmailResult({ sent: json.sent === true, reason: json.reason });
    } catch {
      setEmailResult({ sent: false, reason: "Couldn't reach the server." });
    }
    setEmailSending(false);
  };

  const pointsWord = (count: number): string => {
    if (!result?.found) return "points";
    return count === 1
      ? (result.terminology?.one ?? "Point").toLowerCase()
      : (result.terminology?.other ?? "Points").toLowerCase();
  };

  const nextTier =
    result?.found
      ? result.rewardTiers.find((t) => t.points > result.points) ?? null
      : null;
  const inputClass =
    "w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-dark placeholder:text-dark/30 focus:outline-none focus:border-[#E8A0BF] focus:ring-2 focus:ring-[#E8A0BF]/20 transition-all";

  return (
    <div className="bg-cream min-h-screen py-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="stamp text-burgundy mb-4">Rewards</p>
          <h1 className="font-fun text-burgundy text-5xl md:text-6xl">
            Your <AnimatedSquiggly>Stars</AnimatedSquiggly>
          </h1>
          <p className="text-dark/60 text-sm mt-4 max-w-md mx-auto">
            Enter the email or phone you used at checkout. Every $50 spent earns a Star — no sign-up, no app, nothing to remember.
          </p>
        </div>

        {/* Lookup form */}
        <ScrollReveal>
          <form onSubmit={lookup} className="card-bakery p-6 md:p-8 mb-6">
            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-wider text-dark/50 mb-1.5">
                Email or phone
              </span>
              <input
                type="text"
                placeholder="you@email.com or (555) 123-4567"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className={inputClass}
                autoComplete="off"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary w-full mt-4 disabled:opacity-50"
            >
              {loading ? "Checking…" : "Check my rewards"}
            </button>
          </form>
        </ScrollReveal>

        {/* Result */}
        {result && !result.found && (
          <ScrollReveal>
            <div className="card-bakery p-6 md:p-8 mb-6">
              <p className="text-dark/70">{result.reason}</p>
            </div>
          </ScrollReveal>
        )}

        {result && result.found && (
          <ScrollReveal>
            <div className="card-bakery p-6 md:p-8 mb-6">
              {/* Balance */}
              <div className="text-center pb-6 border-b border-[#f0e6de]">
                <p className="text-xs font-bold uppercase tracking-wider text-dark/40 mb-1">You have</p>
                <p className="font-fun text-burgundy text-6xl md:text-7xl leading-none">
                  {result.points}
                </p>
                <p className="text-dark/60 text-lg mt-2 capitalize">{pointsWord(result.points)}</p>
                {result.lifetimePoints > 0 && (
                  <p className="text-dark/40 text-xs mt-1">
                    Lifetime: {result.lifetimePoints} {pointsWord(result.lifetimePoints)}
                  </p>
                )}
                {nextTier && (
                  <p className="text-burgundy text-sm mt-4 font-semibold">
                    {nextTier.points - result.points} more to unlock{" "}
                    <span className="underline">{nextTier.name}</span>
                  </p>
                )}
              </div>

              {/* Tiers */}
              {result.rewardTiers.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-dark/50 mb-3">Reward tiers</p>
                  <ul className="space-y-2">
                    {result.rewardTiers.map((t) => {
                      const unlocked = result.points >= t.points;
                      const progress = Math.min(100, (result.points / t.points) * 100);
                      return (
                        <li key={t.id} className={`rounded-xl border p-4 ${unlocked ? "border-green-300 bg-green-50/50" : "border-[#f0e6de] bg-[#FFF5EE]"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-semibold text-sm ${unlocked ? "text-green-700" : "text-dark/80"}`}>
                              {t.name}
                            </span>
                            <span className={`text-xs font-bold ${unlocked ? "text-green-700" : "text-dark/50"}`}>
                              {t.points} {pointsWord(t.points)} {unlocked && "· ✓"}
                            </span>
                          </div>
                          {!unlocked && (
                            <div className="h-1.5 bg-white rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-burgundy to-salmon"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Featured deals (admin-curated in /admin/content → rewards.featured_deals) */}
              {result.featuredDeals.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-dark/50 mb-3">✨ Current deals</p>
                  <ul className="space-y-2">
                    {result.featuredDeals.map((d, i) => {
                      const obj = typeof d === "string" ? { title: d, description: undefined } : d;
                      return (
                        <li key={i} className="bg-golden/10 border border-golden/30 rounded-xl p-4">
                          <p className="text-burgundy font-semibold text-sm">{obj.title}</p>
                          {obj.description && (
                            <p className="text-dark/60 text-xs mt-1">{obj.description}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Email-a-copy */}
              <div className="mt-6 pt-6 border-t border-[#f0e6de]">
                <p className="text-xs font-bold uppercase tracking-wider text-dark/50 mb-2">
                  Email me a copy
                </p>
                <p className="text-dark/50 text-xs mb-3">
                  Save this info in your inbox for later.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    onClick={sendEmail}
                    disabled={emailSending || !emailInput.trim()}
                    className="shrink-0 px-5 bg-burgundy text-white rounded-xl font-bold hover:bg-burgundy-dark disabled:opacity-50"
                  >
                    {emailSending ? "…" : "Send"}
                  </button>
                </div>
                {emailResult && (
                  <p className={`text-xs mt-2 ${emailResult.sent ? "text-green-600" : "text-red-500"}`}>
                    {emailResult.sent ? "Sent! Check your inbox." : emailResult.reason}
                  </p>
                )}
              </div>

              {/* Shop CTA */}
              <div className="mt-6 text-center">
                <Link href="/shop" className="inline-block bg-[#E8A0BF] text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-[#d889ad]">
                  Earn more — shop now
                </Link>
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* Back to shop */}
        <div className="text-center mt-6">
          <Link href="/shop" className="text-burgundy/60 hover:text-burgundy text-sm font-semibold">
            ← Back to shop
          </Link>
        </div>
      </div>
    </div>
  );
}
