import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Pickup slot calculation.
 *
 * Reads admin-configured pickup_schedule + closures + settings and returns
 * the concrete list of bookable time slots for a requested date.
 *
 * Timezone: the bakery is in one place (Oakland Park, FL), so all business
 * hours are interpreted in America/New_York. Timestamps in the DB are
 * stored as UTC timestamptz; we convert to local for the slot grid and
 * back to UTC for storage.
 */

export const BAKERY_TZ = "America/New_York";

export interface PickupScheduleDay {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;   // "HH:MM:SS"
  close_time: string | null;
}

export interface PickupSettings {
  slot_duration_minutes: number;
  allow_same_day: boolean;
  same_day_rush_fee_cents: number;
  same_day_min_lead_minutes: number;
  max_days_ahead: number;
}

export interface PickupClosure {
  closure_date: string; // YYYY-MM-DD
  reason: string | null;
}

export interface PickupSlot {
  /** ISO UTC timestamp — pass this to /api/square/pay */
  pickupAt: string;
  /** Human display like "10:08 AM" — already in America/New_York */
  display: string;
  /** Slot time in HH:MM 24h format (local) — for sorting and UI */
  timeKey: string;
  available: boolean;
  reason?: "reserved" | "past" | "closed";
  /** Non-zero if this is a same-day rush slot */
  rushFeeCents: number;
}

interface PickupDayAvailability {
  date: string;  // YYYY-MM-DD in BAKERY_TZ
  isOpen: boolean;
  isClosure: boolean;
  closureReason?: string;
  openTime?: string;
  closeTime?: string;
  slots: PickupSlot[];
  hasAnyAvailable: boolean;
}

function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// ── Timezone-aware date helpers ─────────────────────────────────────────
// Postgres handles TZ for stored data; here we just need to render the
// slot grid in the bakery's local time. Using Intl.DateTimeFormat with
// the fixed BAKERY_TZ keeps us independent of the server's locale.

export function formatLocalDate(d: Date): string {
  // YYYY-MM-DD in BAKERY_TZ
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BAKERY_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const day = parts.find(p => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
}

export function getLocalDayOfWeek(d: Date): number {
  // 0 = Sunday, ..., 6 = Saturday — in BAKERY_TZ.
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: BAKERY_TZ,
    weekday: "short",
  }).format(d);
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const)[weekday as "Sun"] ?? 0;
}

/**
 * Construct a UTC Date representing a specific wall-clock moment in
 * America/New_York. This is the inverse of formatLocalDate + time parsing.
 */
function localDateTimeToUtc(dateStr: string, timeStr: string): Date {
  // Build an ISO string and then offset by the TZ. Because JS has no
  // native "construct Date from wall-clock in TZ" primitive, we use a
  // probe date to derive the offset for that moment.
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss = 0] = timeStr.split(":").map(Number);

  // First guess: treat components as UTC. This is wrong by exactly the
  // BAKERY_TZ offset at that instant.
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));

  // Ask Intl what that UTC instant looks like in BAKERY_TZ wall-clock.
  // The difference between the requested wall-clock and the rendered
  // wall-clock is the offset we need to subtract.
  const partsInTz = new Intl.DateTimeFormat("en-US", {
    timeZone: BAKERY_TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(guess);
  const lookup = (t: string) => Number(partsInTz.find(p => p.type === t)!.value);

  const rendered = Date.UTC(
    lookup("year"), lookup("month") - 1, lookup("day"),
    lookup("hour") === 24 ? 0 : lookup("hour"), lookup("minute"), lookup("second"),
  );
  const offsetMs = rendered - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

function formatDisplayTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BAKERY_TZ, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d);
}

function formatTimeKey(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BAKERY_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d).replace(/^24:/, "00:"); // Edge case: midnight renders as "24:00" in some locales
}

// ── Data loading ────────────────────────────────────────────────────────

export async function loadPickupConfig(sb?: SupabaseClient): Promise<{
  schedule: Map<number, PickupScheduleDay>;
  settings: PickupSettings;
}> {
  const supabase = sb ?? getServiceClient();
  const [scheduleResp, settingsResp] = await Promise.all([
    supabase.from("pickup_schedule").select("*"),
    supabase.from("pickup_settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  const schedule = new Map<number, PickupScheduleDay>();
  for (const row of (scheduleResp.data ?? []) as PickupScheduleDay[]) {
    schedule.set(row.day_of_week, row);
  }

  const settings: PickupSettings = settingsResp.data ?? {
    slot_duration_minutes: 8,
    allow_same_day: true,
    same_day_rush_fee_cents: 500,
    same_day_min_lead_minutes: 30,
    max_days_ahead: 14,
  };

  return { schedule, settings };
}

async function loadReservedTimesForDate(
  dateStr: string,
  sb: SupabaseClient,
): Promise<Set<string>> {
  const dayStartUtc = localDateTimeToUtc(dateStr, "00:00:00");
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);
  const { data } = await sb
    .from("pickup_reservations")
    .select("pickup_at")
    .gte("pickup_at", dayStartUtc.toISOString())
    .lt("pickup_at", dayEndUtc.toISOString())
    .neq("status", "cancelled");
  return new Set((data ?? []).map((r: { pickup_at: string }) => r.pickup_at));
}

async function loadClosure(dateStr: string, sb: SupabaseClient): Promise<PickupClosure | null> {
  const { data } = await sb
    .from("pickup_closures")
    .select("*")
    .eq("closure_date", dateStr)
    .maybeSingle();
  return (data as PickupClosure | null) ?? null;
}

// ── Slot calculation ────────────────────────────────────────────────────

export async function getSlotsForDate(
  dateStr: string,
  now: Date = new Date(),
  sb?: SupabaseClient,
): Promise<PickupDayAvailability> {
  const supabase = sb ?? getServiceClient();
  const { schedule, settings } = await loadPickupConfig(supabase);

  const probe = localDateTimeToUtc(dateStr, "12:00:00");
  const dow = getLocalDayOfWeek(probe);
  const day = schedule.get(dow);
  const closure = await loadClosure(dateStr, supabase);

  if (closure) {
    return {
      date: dateStr,
      isOpen: false,
      isClosure: true,
      closureReason: closure.reason ?? undefined,
      slots: [],
      hasAnyAvailable: false,
    };
  }

  if (!day?.is_open || !day.open_time || !day.close_time) {
    return { date: dateStr, isOpen: false, isClosure: false, slots: [], hasAnyAvailable: false };
  }

  const openUtc = localDateTimeToUtc(dateStr, day.open_time);
  const closeUtc = localDateTimeToUtc(dateStr, day.close_time);
  const slotMs = settings.slot_duration_minutes * 60 * 1000;

  const reserved = await loadReservedTimesForDate(dateStr, supabase);
  const isToday = dateStr === formatLocalDate(now);

  const slots: PickupSlot[] = [];
  for (let t = openUtc.getTime(); t < closeUtc.getTime(); t += slotMs) {
    const slotDate = new Date(t);
    const iso = slotDate.toISOString();
    const slotKey = formatTimeKey(slotDate);

    // Reservations compare exactly on the ISO timestamp; since we insert
    // slot times at minute-precision matching this grid, set lookup works.
    const isReserved = reserved.has(iso);
    const leadMs = t - now.getTime();
    const isPast = leadMs <= 0;
    const needsRush = isToday && !isPast && leadMs < settings.same_day_min_lead_minutes * 60 * 1000;
    const isTooSoonEvenForRush = isToday && !isPast && leadMs < 15 * 60 * 1000; // 15 min hard floor

    let available = !isReserved && !isPast && !isTooSoonEvenForRush;
    if (needsRush && !settings.allow_same_day) available = false;

    const reason: PickupSlot["reason"] | undefined =
      isReserved ? "reserved" : isPast ? "past" : !available ? "closed" : undefined;

    slots.push({
      pickupAt: iso,
      display: formatDisplayTime(slotDate),
      timeKey: slotKey,
      available,
      reason,
      rushFeeCents: needsRush && available ? settings.same_day_rush_fee_cents : 0,
    });
  }

  return {
    date: dateStr,
    isOpen: true,
    isClosure: false,
    openTime: day.open_time,
    closeTime: day.close_time,
    slots,
    hasAnyAvailable: slots.some(s => s.available),
  };
}

/**
 * Find the earliest date with at least one available slot. Customer's
 * default selection on checkout — usually tomorrow, but jumps ahead
 * past closures or fully-booked days.
 */
export async function getNextAvailableDate(
  now: Date = new Date(),
  sb?: SupabaseClient,
): Promise<string | null> {
  const supabase = sb ?? getServiceClient();
  const { settings } = await loadPickupConfig(supabase);

  for (let offset = 0; offset <= settings.max_days_ahead; offset++) {
    const probe = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const dateStr = formatLocalDate(probe);
    const day = await getSlotsForDate(dateStr, now, supabase);
    if (day.hasAnyAvailable) return dateStr;
  }

  return null;
}

/**
 * Customer-safe subset of pickup settings — no writable fields beyond
 * what the checkout needs to render.
 */
export function publicSettings(s: PickupSettings) {
  return {
    slot_duration_minutes: s.slot_duration_minutes,
    allow_same_day: s.allow_same_day,
    same_day_rush_fee_cents: s.same_day_rush_fee_cents,
    max_days_ahead: s.max_days_ahead,
  };
}
