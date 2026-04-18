import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin auth guard for API routes.
 *
 * Verifies the request has a valid Supabase session JWT (from our
 * admin login at /admin/login). Returns a NextResponse with 401 if
 * unauthorized, or null if allowed to proceed.
 *
 * Usage inside an API route handler:
 *   const unauthorized = await requireAdmin(req);
 *   if (unauthorized) return unauthorized;
 */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    // Also check for Supabase session cookie as fallback
    const cookie = req.cookies.get("sb-access-token")?.value;
    if (!cookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token || undefined);

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // Allowed
}
