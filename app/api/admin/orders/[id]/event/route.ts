import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { logError } from "@/lib/log-error";

/**
 * POST /api/admin/orders/[id]/event
 *
 * Tag an order with an event (for in-person POS sales at Haley's tent
 * events). Body: { event_id: string | null } — pass null to untag.
 *
 * Admin-only. We use service role so the update bypasses RLS; the auth
 * check at the top gates on admin_users membership.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const eventId: string | null = body.event_id ?? null;

    if (eventId !== null && typeof eventId !== "string") {
      return NextResponse.json({ error: "event_id must be string or null" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { error } = await supabase
      .from("square_orders")
      .update({ event_id: eventId })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ saved: true });
  } catch (err) {
    await logError(err, { path: "/api/admin/orders/[id]/event", source: "api-route" });
    return NextResponse.json({ error: "Could not tag order" }, { status: 500 });
  }
}
