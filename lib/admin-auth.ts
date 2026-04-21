import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin auth guard for API routes.
 *
 * Verifies the request has a valid Supabase session JWT AND that the
 * signed-in user's email is in the admin_users whitelist. Without the
 * admin_users check, any authenticated Supabase user could hit admin
 * endpoints — and since those endpoints use the service-role client
 * (bypassing RLS) the DB policies wouldn't catch it either.
 *
 * Returns a NextResponse with 401/403 on rejection, or null if allowed.
 *
 * Usage inside an API route handler:
 *   const unauthorized = await requireAdmin(req);
 *   if (unauthorized) return unauthorized;
 */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = req.cookies.get("sb-access-token")?.value ?? null;
  const effectiveToken = token ?? cookieToken;

  if (!effectiveToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: { user }, error } = await authClient.auth.getUser(effectiveToken);
  if (error || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Service-role lookup against admin_users. Must use service role because
  // admin_users RLS only allows admins to read it — a chicken-and-egg we
  // sidestep here.
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: adminRow } = await serviceClient
    .from("admin_users")
    .select("email")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  if (!adminRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
