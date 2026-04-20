import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { logError } from "@/lib/log-error";

/**
 * /api/admin/content
 *
 * GET  — list all cms_content rows, grouped by key prefix for display
 * PUT  — upsert a single key: body = { key, value }
 */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("cms_content")
      .select("key, value, updated_at")
      .order("key");

    if (error) {
      await logError(error, { path: "/api/admin/content:GET", source: "api-route" });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    await logError(err, { path: "/api/admin/content:GET", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to load content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const { key, value } = body as { key?: string; value?: unknown };

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "key (string) is required" }, { status: 400 });
    }
    if (value === undefined) {
      return NextResponse.json({ error: "value is required" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { error } = await supabase
      .from("cms_content")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) {
      await logError(error, {
        path: "/api/admin/content:PUT",
        source: "api-route",
        context: { key },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    await logError(err, { path: "/api/admin/content:PUT", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to save content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

    const supabase = getServiceClient();
    const { error } = await supabase.from("cms_content").delete().eq("key", key);
    if (error) {
      await logError(error, { path: "/api/admin/content:DELETE", source: "api-route", context: { key } });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    await logError(err, { path: "/api/admin/content:DELETE", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to delete content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
