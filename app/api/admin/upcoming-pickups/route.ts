import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { BAKERY_TZ, formatLocalDate } from "@/lib/pickup";
import { logError } from "@/lib/log-error";

/**
 * GET /api/admin/upcoming-pickups
 *
 * Admin-only. Returns pickup reservations for today + tomorrow, grouped by
 * local date, sorted by pickup_at ascending. Dashboard widget shows this
 * so Haley can see exactly what she needs to bake next.
 */

interface ReservationRow {
  pickup_at: string;
  square_order_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  items: Array<{ name?: string; variationId?: string; quantity: number }> | null;
  rush_fee_cents: number;
  status: string;
  notes: string | null;
}

export async function GET(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const now = new Date();
    const todayStr = formatLocalDate(now);
    const tomorrowStr = formatLocalDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    // Window: now → end of tomorrow (local). Cover the full 48h window in UTC.
    const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("pickup_reservations")
      .select("*")
      .gte("pickup_at", now.toISOString())
      .lt("pickup_at", windowEnd.toISOString())
      .neq("status", "cancelled")
      .order("pickup_at");

    if (error) throw error;

    // Bucket each reservation by its local date.
    const today: ReservationRow[] = [];
    const tomorrow: ReservationRow[] = [];
    const later: ReservationRow[] = [];
    for (const row of (data ?? []) as ReservationRow[]) {
      const localDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: BAKERY_TZ,
        year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(row.pickup_at));
      if (localDate === todayStr) today.push(row);
      else if (localDate === tomorrowStr) tomorrow.push(row);
      else later.push(row);
    }

    return NextResponse.json({ today, tomorrow, later, todayDate: todayStr, tomorrowDate: tomorrowStr });
  } catch (err) {
    await logError(err, { path: "/api/admin/upcoming-pickups", source: "api-route" });
    return NextResponse.json({ error: "Load failed" }, { status: 500 });
  }
}
