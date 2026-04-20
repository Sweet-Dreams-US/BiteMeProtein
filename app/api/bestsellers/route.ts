import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log-error";

/**
 * GET /api/bestsellers?limit=10
 *
 * Returns products ranked by units sold, aggregated from
 * square_order_line_items (synced in sub-project 2 from every Square sale,
 * POS + online). Public endpoint — only aggregate data is exposed, never
 * individual orders or customer info.
 *
 * Shape: { items: Array<{ name: string; total_sold: number }>, source: "sales" | "empty" }
 *
 * If the mirror hasn't been populated yet (new site, pre-backfill) or no
 * orders exist, returns { items: [], source: "empty" } so callers can
 * fall back to their own default ordering.
 *
 * Uses the service role so RLS on square_order_line_items (admin-only
 * SELECT) doesn't block the aggregate read. Returning only grouped counts
 * keeps customer PII out of the response.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit") ?? 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 10, 1), 50);

    const supabase = getServiceClient();

    // Pull name + quantity for every line item. Quantity is stored as text
    // in Square's API, so we sum after parsing in JS rather than SQL cast.
    const { data, error } = await supabase
      .from("square_order_line_items")
      .select("name, quantity")
      .not("name", "is", null)
      .limit(50_000);

    if (error) {
      await logError(error, { path: "/api/bestsellers", source: "api-route" });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ items: [], source: "empty" });
    }

    const totals = new Map<string, number>();
    for (const row of data as Array<{ name: string; quantity: string | null }>) {
      const qty = Number(row.quantity ?? "0") || 0;
      const name = row.name.trim();
      if (!name) continue;
      totals.set(name, (totals.get(name) ?? 0) + qty);
    }

    const items = Array.from(totals.entries())
      .map(([name, total_sold]) => ({ name, total_sold }))
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, limit);

    return NextResponse.json({ items, source: "sales" });
  } catch (err) {
    await logError(err, { path: "/api/bestsellers", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to load bestsellers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
