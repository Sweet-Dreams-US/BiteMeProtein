import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log-error";

/**
 * GET /account/callback?code=...
 *
 * Completes the magic-link flow: exchanges the OTP code for a session,
 * then ensures a customer_profiles row exists for this user.
 *
 * First-time sign-in: inserts a new row and tries to link it to a
 * square_customer by matching email (case-insensitive).
 *
 * Returning sign-in: bumps last_signin_at.
 *
 * On any failure, redirects to /account/login with ?error=...; session
 * creation failures are rare (typically an expired link).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function getAnonClient(req: NextRequest) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: req.headers.get("authorization") ?? "" },
      },
    },
  );
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || url.origin;

  // No code? Fell through something weird — bounce back to login.
  if (!code) {
    return NextResponse.redirect(`${origin}/account/login?error=missing_code`);
  }

  try {
    const anon = getAnonClient(req);
    const { data: exchange, error: exchangeErr } = await anon.auth.exchangeCodeForSession(code);
    if (exchangeErr || !exchange?.session) {
      return NextResponse.redirect(
        `${origin}/account/login?error=${encodeURIComponent(exchangeErr?.message ?? "sign_in_failed")}`,
      );
    }

    const user = exchange.user;
    if (!user) {
      return NextResponse.redirect(`${origin}/account/login?error=no_user`);
    }

    // Ensure profile exists. Using service role so we bypass the deny-by-
    // default INSERT policy on customer_profiles.
    const admin = getServiceClient();
    const { data: existing } = await admin
      .from("customer_profiles")
      .select("user_id, square_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      // Try to match an existing square_customers row by email.
      let squareCustomerId: string | null = null;
      if (user.email) {
        const { data: match } = await admin
          .from("square_customers")
          .select("id")
          .ilike("email", user.email)
          .maybeSingle();
        squareCustomerId = (match as { id?: string } | null)?.id ?? null;
      }

      await admin.from("customer_profiles").insert({
        user_id: user.id,
        email: user.email ?? "",
        square_customer_id: squareCustomerId,
        last_signin_at: new Date().toISOString(),
      });
    } else {
      await admin
        .from("customer_profiles")
        .update({ last_signin_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }

    // Session is already set via the cookie exchangeCodeForSession wrote.
    const response = NextResponse.redirect(`${origin}/account`);
    // Carry forward the access/refresh tokens via cookies that
    // supabase-js can read on the next page load.
    response.cookies.set("sb-access-token", exchange.session.access_token, {
      httpOnly: false,
      sameSite: "lax",
      secure: origin.startsWith("https"),
      path: "/",
    });
    response.cookies.set("sb-refresh-token", exchange.session.refresh_token, {
      httpOnly: false,
      sameSite: "lax",
      secure: origin.startsWith("https"),
      path: "/",
    });
    return response;
  } catch (err: any) {
    await logError(err, { path: "/account/callback", source: "api-route" });
    return NextResponse.redirect(
      `${origin}/account/login?error=${encodeURIComponent(err?.message ?? "unexpected_error")}`,
    );
  }
}
