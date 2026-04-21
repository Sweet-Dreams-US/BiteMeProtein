import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadPickupConfig, formatLocalDate, getLocalDayOfWeek, BAKERY_TZ } from "@/lib/pickup";
import { logError } from "@/lib/log-error";

/**
 * GET /api/pickup/availability
 *
 * Returns a lightweight list of the next N days with metadata about which
 * days are open/closed/fully-booked. Used by the date picker to gray out
 * unavailable dates without fetching slot grids for each.
 *
 * Response shape:
 *   { days: [{ date, isOpen, isClosure, hasAnyAvailable }, ...] }
 *
 * "hasAnyAvailable" requires counting existing reservations; we group the
 * DB query by date to keep this cheap.
 */

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const daysRequested = Math.min(
      Number(url.searchParams.get("days") ?? "14"),
      30,
    );
    const now = new Date();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { schedule, ranges, settings } = await loadPickupConfig(supabase);

    // Range for the whole window, used by both closure + reservation fetches.
    const windowStart = new Date(now.getTime());
    const windowEnd = new Date(now.getTime() + daysRequested * 24 * 60 * 60 * 1000);

    const [closuresResp, reservationsResp] = await Promise.all([
      supabase
        .from("pickup_closures")
        .select("closure_date, reason")
        .gte("closure_date", formatLocalDate(windowStart))
        .lte("closure_date", formatLocalDate(windowEnd)),
      supabase
        .from("pickup_reservations")
        .select("pickup_at")
        .gte("pickup_at", windowStart.toISOString())
        .lt("pickup_at", windowEnd.toISOString())
        .neq("status", "cancelled"),
    ]);

    const closures = new Map<string, string | null>();
    for (const row of (closuresResp.data ?? []) as Array<{ closure_date: string; reason: string | null }>) {
      closures.set(row.closure_date, row.reason);
    }

    // Count reserved slots per local date — a day is "full" if the reserved
    // count equals the total slot count the schedule can produce. We don't
    // need per-slot granularity here, just whether any slot remains.
    const reservedByDate = new Map<string, number>();
    for (const row of (reservationsResp.data ?? []) as Array<{ pickup_at: string }>) {
      const local = new Intl.DateTimeFormat("en-CA", {
        timeZone: BAKERY_TZ,
        year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(row.pickup_at));
      reservedByDate.set(local, (reservedByDate.get(local) ?? 0) + 1);
    }

    const days = [];
    for (let offset = 0; offset <= daysRequested; offset++) {
      const probe = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
      const dateStr = formatLocalDate(probe);
      const dow = getLocalDayOfWeek(probe);
      const day = schedule.get(dow);

      const isClosure = closures.has(dateStr);
      const closureReason = closures.get(dateStr) ?? undefined;
      const isOpen = !isClosure && !!day?.is_open;

      // Sum capacity across all configured ranges for this day (split shifts
      // each contribute their own slots). Falls back to the legacy single
      // open_time/close_time when no ranges exist yet.
      let slotCount = 0;
      let hasAnyAvailable = false;
      if (isOpen) {
        const dayRanges = ranges.get(dow) ?? [];
        const rangeList = dayRanges.length > 0
          ? dayRanges.map(r => ({ open: r.open_time, close: r.close_time }))
          : (day?.open_time && day?.close_time
            ? [{ open: day.open_time, close: day.close_time }]
            : []);
        for (const r of rangeList) {
          const [openH, openM] = r.open.split(":").map(Number);
          const [closeH, closeM] = r.close.split(":").map(Number);
          const mins = (closeH * 60 + closeM) - (openH * 60 + openM);
          slotCount += Math.max(0, Math.floor(mins / settings.slot_duration_minutes));
        }
        const reserved = reservedByDate.get(dateStr) ?? 0;
        hasAnyAvailable = slotCount > reserved;
      }

      days.push({
        date: dateStr,
        isOpen,
        isClosure,
        closureReason,
        hasAnyAvailable,
        slotCount,
        reservedCount: reservedByDate.get(dateStr) ?? 0,
      });
    }

    return NextResponse.json({ days });
  } catch (err) {
    await logError(err, { path: "/api/pickup/availability", source: "api-route" });
    return NextResponse.json(
      { error: "Could not load availability." },
      { status: 500 },
    );
  }
}
