import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { logError } from "@/lib/log-error";

/**
 * Admin API for pickup_schedule (weekly hours), pickup_closures (one-off
 * closed dates), and pickup_settings (slot duration, rush fee, etc.).
 *
 * GET  — returns current schedule + closures + settings (for the admin UI)
 * POST — body { schedule?, closures?, settings? }, updates whichever sections
 *         are present. Schedule rows are upserted by day_of_week; closures
 *         are replaced wholesale when provided to keep the admin UX simple.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SchedulePayload {
  day_of_week: number;
  is_open: boolean;
  /** List of open time ranges for this day, e.g. [{open:"10:00",close:"14:00"},{open:"16:00",close:"20:00"}] */
  ranges?: Array<{ open_time: string; close_time: string }>;
  /** Legacy single-range fields — still accepted but ranges[] takes precedence when both present */
  open_time?: string | null;
  close_time?: string | null;
}

interface ClosurePayload {
  closure_date: string; // YYYY-MM-DD
  reason?: string | null;
}

interface SettingsPayload {
  slot_duration_minutes?: number;
  allow_same_day?: boolean;
  same_day_rush_fee_cents?: number;
  same_day_min_lead_minutes?: number;
  max_days_ahead?: number;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  try {
    const supabase = getServiceClient();
    const [schedResp, rangesResp, closuresResp, settingsResp] = await Promise.all([
      supabase.from("pickup_schedule").select("*").order("day_of_week"),
      supabase.from("pickup_schedule_ranges").select("*").order("day_of_week").order("sort_order"),
      supabase.from("pickup_closures").select("*").order("closure_date"),
      supabase.from("pickup_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    // Attach ranges to each day so the admin UI gets a self-contained view.
    // Fall back to synthesizing a single range from the legacy open/close
    // fields if no rows exist in pickup_schedule_ranges yet.
    const rangesByDay = new Map<number, Array<{ id: string; open_time: string; close_time: string }>>();
    for (const row of (rangesResp.data ?? []) as Array<{
      id: string; day_of_week: number; open_time: string; close_time: string; sort_order: number;
    }>) {
      const arr = rangesByDay.get(row.day_of_week) ?? [];
      arr.push({ id: row.id, open_time: row.open_time, close_time: row.close_time });
      rangesByDay.set(row.day_of_week, arr);
    }

    const schedule = (schedResp.data ?? []).map((d: SchedulePayload) => ({
      ...d,
      ranges: rangesByDay.get(d.day_of_week) ?? (d.is_open && d.open_time && d.close_time
        ? [{ id: "legacy", open_time: d.open_time, close_time: d.close_time }]
        : []),
    }));

    return NextResponse.json({
      schedule,
      closures: closuresResp.data ?? [],
      settings: settingsResp.data,
    });
  } catch (err) {
    await logError(err, { path: "/api/admin/pickup-schedule:GET", source: "api-route" });
    return NextResponse.json({ error: "Load failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = getServiceClient();

    if (Array.isArray(body.schedule)) {
      for (const row of body.schedule as SchedulePayload[]) {
        if (typeof row.day_of_week !== "number" || row.day_of_week < 0 || row.day_of_week > 6) continue;

        // Normalize ranges. Accept either the new ranges[] or the legacy
        // single open_time/close_time — ranges[] wins when both present.
        const incomingRanges: Array<{ open_time: string; close_time: string }> = [];
        if (Array.isArray(row.ranges) && row.ranges.length > 0) {
          for (const r of row.ranges) {
            if (r.open_time && r.close_time && r.open_time < r.close_time) {
              incomingRanges.push({ open_time: r.open_time, close_time: r.close_time });
            }
          }
        } else if (row.is_open && row.open_time && row.close_time && row.open_time < row.close_time) {
          incomingRanges.push({ open_time: row.open_time, close_time: row.close_time });
        }

        const isOpen = !!row.is_open && incomingRanges.length > 0;

        // Upsert the parent row. Keep open_time/close_time populated from
        // the first range as a back-compat hint for anything still reading
        // those columns. Day is closed → null both.
        await supabase.from("pickup_schedule").upsert({
          day_of_week: row.day_of_week,
          is_open: isOpen,
          open_time: isOpen ? incomingRanges[0].open_time : null,
          close_time: isOpen ? incomingRanges[incomingRanges.length - 1].close_time : null,
          updated_at: new Date().toISOString(),
        });

        // Replace-all semantics for ranges. Delete existing + insert new.
        await supabase.from("pickup_schedule_ranges").delete().eq("day_of_week", row.day_of_week);
        if (isOpen) {
          await supabase.from("pickup_schedule_ranges").insert(
            incomingRanges.map((r, i) => ({
              day_of_week: row.day_of_week,
              open_time: r.open_time,
              close_time: r.close_time,
              sort_order: i,
            })),
          );
        }
      }
    }

    if (Array.isArray(body.closures)) {
      // Replace-all semantics: delete everything in the future, then insert
      // the payload. Past closures stay as history.
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from("pickup_closures").delete().gte("closure_date", today);
      const rows = (body.closures as ClosurePayload[])
        .filter(c => c.closure_date && /^\d{4}-\d{2}-\d{2}$/.test(c.closure_date) && c.closure_date >= today)
        .map(c => ({ closure_date: c.closure_date, reason: c.reason ?? null }));
      if (rows.length > 0) {
        await supabase.from("pickup_closures").upsert(rows);
      }
    }

    if (body.settings && typeof body.settings === "object") {
      const s = body.settings as SettingsPayload;
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof s.slot_duration_minutes === "number") update.slot_duration_minutes = s.slot_duration_minutes;
      if (typeof s.allow_same_day === "boolean") update.allow_same_day = s.allow_same_day;
      if (typeof s.same_day_rush_fee_cents === "number") update.same_day_rush_fee_cents = s.same_day_rush_fee_cents;
      if (typeof s.same_day_min_lead_minutes === "number") update.same_day_min_lead_minutes = s.same_day_min_lead_minutes;
      if (typeof s.max_days_ahead === "number") update.max_days_ahead = s.max_days_ahead;
      await supabase.from("pickup_settings").update(update).eq("id", 1);
    }

    return NextResponse.json({ saved: true });
  } catch (err: any) {
    await logError(err, { path: "/api/admin/pickup-schedule:POST", source: "api-route" });
    return NextResponse.json({ error: err?.message ?? "Save failed" }, { status: 500 });
  }
}
