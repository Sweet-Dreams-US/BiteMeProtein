"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AccountLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Already signed in? Redirect to /account.
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace("/account");
    })();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setSending(true);
    const redirectTo = `${window.location.origin}/account/callback`;
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setSending(false);

    if (otpErr) {
      setError(otpErr.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="bg-white rounded-2xl border border-[#f0e6de] shadow-sm p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-[#5a3e36] mb-2">Welcome back</h1>
          <p className="text-[#7a6a62] text-sm">
            Enter your email and we&apos;ll send you a one-click link to sign in. No password needed.
          </p>
        </div>

        {sent ? (
          <div className="bg-[#FFF5EE] rounded-xl p-6 text-center">
            <p className="text-2xl mb-2">📬</p>
            <p className="text-[#5a3e36] font-semibold mb-1">Check your inbox</p>
            <p className="text-[#7a6a62] text-sm">
              We just emailed a sign-in link to <strong>{email}</strong>. Click it on this device to finish signing in.
            </p>
            <button
              type="button"
              onClick={() => { setSent(false); setEmail(""); }}
              className="mt-4 text-xs text-[#843430] hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-xs font-semibold text-[#7a6a62] uppercase tracking-wider mb-1.5">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-[#5a3e36] focus:border-[#E8A0BF] focus:ring-1 focus:ring-[#E8A0BF] focus:outline-none"
                required
              />
            </label>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full bg-[#843430] hover:bg-[#6e2a27] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send me a sign-in link"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-[#b0a098] mt-6">
          New here? You&apos;ll be signed in automatically — no separate sign-up needed.
        </p>

        <p className="text-center text-xs text-[#b0a098] mt-2">
          <Link href="/" className="hover:text-[#7a6a62]">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
