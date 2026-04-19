import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { logError } from "@/lib/log-error";

/**
 * GET /api/admin/errors
 *
 * Admin-only. Returns rows from the error_logs table, filtered.
 *
 * Query params:
 *   level=error|warn|info
 *   source=api-route|lib|client|webhook
 *   since=7d|30d|90d|all   (default 7d)
 *   q=<substring>          (case-insensitive match against message + path)
 *   limit=50               (default 50, max 200)
 *   before=<ISO timestamp> (for cursor pagination: rows with created_at < before)
 */
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level");
    const source = searchParams.get("source");
    const since = searchParams.get("since") ?? "7d";
    const q = searchParams.get("q")?.trim() ?? "";
    const limitRaw = Number(searchParams.get("limit") ?? 50);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
    const before = searchParams.get("before");

    // Use service role so RLS deny-by-default doesn't get in the way —
    // we've already gated by requireAdmin.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    let query = supabase
      .from("error_logs")
      .select("id, created_at, level, source, path, message, stack, context, user_id, request_id")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Time window
    if (since !== "all") {
      const days = since === "30d" ? 30 : since === "90d" ? 90 : 7;
      const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", sinceIso);
    }

    if (level) query = query.eq("level", level);
    if (source) query = query.eq("source", source);

    if (q) {
      // Postgres ilike for case-insensitive substring
      query = query.or(`message.ilike.%${q}%,path.ilike.%${q}%`);
    }

    if (before) query = query.lt("created_at", before);

    const { data, error } = await query;
    if (error) {
      await logError(error, {
        path: "/api/admin/errors",
        source: "api-route",
        context: { filters: { level, source, since, q, limit } },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      rows: data ?? [],
      nextCursor: data && data.length === limit ? data[data.length - 1].created_at : null,
    });
  } catch (err: unknown) {
    await logError(err, {
      path: "/api/admin/errors",
      source: "api-route",
    });
    const message = err instanceof Error ? err.message : "Failed to load error logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
