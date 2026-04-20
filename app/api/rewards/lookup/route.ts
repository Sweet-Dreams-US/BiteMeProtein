import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLoyaltyBalance, getLoyaltyProgram, normalizePhone } from "@/lib/loyalty";
import { logError } from "@/lib/log-error";

/**
 * POST /api/rewards/lookup
 *
 * Public endpoint — customer enters their email or phone on /rewards
 * and gets back their points + reward tiers + any admin-surfaced deals.
 *
 * Body: { input: string }
 *   - If input parses as a phone, use it directly as the loyalty key.
 *   - Else try email: look up square_customers by email, pull their phone,
 *     then use that phone for loyalty.
 *
 * Response:
 *   { found: true, phone, email?, points, lifetimePoints, terminology,
 *     rewardTiers, featuredDeals }
 *   or
 *   { found: false, reason }
 *
 * "featuredDeals" comes from cms_content.rewards_featured_deals — an array
 * of { title, description } objects the admin curates via /admin/content.
 * Customer-specific targeting is out of scope for v1; same deals shown to
 * everyone who looks up their balance.
 */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const raw = typeof body.input === "string" ? body.input.trim() : "";

    if (!raw) {
      return NextResponse.json({ found: false, reason: "Enter your email or phone" }, { status: 200 });
    }

    let phone: string | null = null;
    let email: string | null = null;

    if (looksLikeEmail(raw)) {
      const emailLower = raw.toLowerCase();
      email = emailLower;
      // Look up their phone from the customer mirror.
      const supabase = getServiceClient();
      const { data } = await supabase
        .from("square_customers")
        .select("phone, email")
        .ilike("email", emailLower)
        .not("phone", "is", null)
        .limit(1)
        .maybeSingle();
      phone = normalizePhone((data as { phone?: string } | null)?.phone ?? null);
      if (!phone) {
        return NextResponse.json({
          found: false,
          reason:
            "We don't have a rewards account matching that email. Try your phone number instead — that's the key for Square Loyalty.",
        });
      }
    } else {
      phone = normalizePhone(raw);
      if (!phone) {
        return NextResponse.json({
          found: false,
          reason: "That doesn't look like a valid email or US phone number.",
        });
      }
      // Optional: look up email for the "Email me a copy" feature later.
      const supabase = getServiceClient();
      const { data } = await supabase
        .from("square_customers")
        .select("email")
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();
      email = (data as { email?: string } | null)?.email ?? null;
    }

    // Pull balance + program metadata from Square.
    const [balance, program] = await Promise.all([
      getLoyaltyBalance(phone),
      getLoyaltyProgram(),
    ]);

    if (!program) {
      return NextResponse.json({
        found: false,
        reason: "Our rewards program isn't active yet — check back soon!",
      });
    }

    // Admin-curated deals list (jsonb array of { title, description } — or
    // strings, if the admin wrote them that way). Falls back to [] if unset.
    const supabase = getServiceClient();
    const { data: dealsRow } = await supabase
      .from("cms_content")
      .select("value")
      .eq("key", "rewards.featured_deals")
      .maybeSingle();

    const featuredDeals = Array.isArray(dealsRow?.value) ? dealsRow.value : [];

    return NextResponse.json({
      found: true,
      phone,
      email,
      points: balance?.points ?? 0,
      lifetimePoints: balance?.lifetimePoints ?? 0,
      terminology: program.terminology,
      rewardTiers: program.rewardTiers,
      featuredDeals,
    });
  } catch (err) {
    await logError(err, { path: "/api/rewards/lookup", source: "api-route" });
    return NextResponse.json(
      { found: false, reason: "Couldn't look that up right now. Try again in a moment." },
      { status: 500 },
    );
  }
}
