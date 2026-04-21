import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Supabase so getSlotsForDate pulls in-test schedule/settings/closures/reservations
// Maps a small query DSL onto an in-memory data structure.
interface Store {
  pickup_schedule: Array<{ day_of_week: number; is_open: boolean; open_time: string | null; close_time: string | null }>;
  pickup_schedule_ranges: Array<{ id: string; day_of_week: number; open_time: string; close_time: string; sort_order: number }>;
  pickup_settings: {
    slot_duration_minutes: number;
    allow_same_day: boolean;
    same_day_rush_fee_cents: number;
    same_day_min_lead_minutes: number;
    max_days_ahead: number;
  };
  pickup_closures: Array<{ closure_date: string; reason: string | null }>;
  pickup_reservations: Array<{ pickup_at: string; status?: string }>;
}

const store: Store = {
  pickup_schedule: [],
  pickup_schedule_ranges: [],
  pickup_settings: {
    slot_duration_minutes: 8,
    allow_same_day: true,
    same_day_rush_fee_cents: 500,
    same_day_min_lead_minutes: 30,
    max_days_ahead: 14,
  },
  pickup_closures: [],
  pickup_reservations: [],
};

function buildQuery(table: keyof Store) {
  // Chainable stub supporting .select().eq().gte().lt().neq().order().maybeSingle()
  let rows: unknown[] = Array.isArray(store[table]) ? [...(store[table] as unknown[])] : [store[table]];

  const api = {
    select: (_cols: string) => api,
    eq: (col: string, val: unknown) => {
      rows = rows.filter(r => (r as Record<string, unknown>)[col] === val);
      return api;
    },
    neq: (col: string, val: unknown) => {
      rows = rows.filter(r => (r as Record<string, unknown>)[col] !== val);
      return api;
    },
    gte: (col: string, val: unknown) => {
      rows = rows.filter(r => ((r as Record<string, unknown>)[col] as string) >= (val as string));
      return api;
    },
    lt: (col: string, val: unknown) => {
      rows = rows.filter(r => ((r as Record<string, unknown>)[col] as string) < (val as string));
      return api;
    },
    lte: (col: string, val: unknown) => {
      rows = rows.filter(r => ((r as Record<string, unknown>)[col] as string) <= (val as string));
      return api;
    },
    order: (_col: string) => api,
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    then: (resolve: (value: { data: unknown[]; error: null }) => void) => {
      resolve({ data: rows, error: null });
      return Promise.resolve({ data: rows, error: null });
    },
  };
  return api;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => buildQuery(table as keyof Store),
  }),
}));

import { getSlotsForDate, getNextAvailableDate, formatLocalDate } from "./pickup";

// A known reference point: Monday, May 4, 2026 at 14:00 UTC (10:00 ET DST).
// Using a non-DST-edge date so arithmetic is predictable in tests.
const REFERENCE_NOW = new Date("2026-05-04T14:00:00Z"); // Monday 10am ET

beforeEach(() => {
  // Reset schedule to Mon-Sat open 10-18, Sun closed.
  store.pickup_schedule = [
    { day_of_week: 0, is_open: false, open_time: null, close_time: null },
    { day_of_week: 1, is_open: true, open_time: "10:00:00", close_time: "18:00:00" },
    { day_of_week: 2, is_open: true, open_time: "10:00:00", close_time: "18:00:00" },
    { day_of_week: 3, is_open: true, open_time: "10:00:00", close_time: "18:00:00" },
    { day_of_week: 4, is_open: true, open_time: "10:00:00", close_time: "18:00:00" },
    { day_of_week: 5, is_open: true, open_time: "10:00:00", close_time: "18:00:00" },
    { day_of_week: 6, is_open: true, open_time: "10:00:00", close_time: "18:00:00" },
  ];
  store.pickup_schedule_ranges = [];
  store.pickup_closures = [];
  store.pickup_reservations = [];
  store.pickup_settings = {
    slot_duration_minutes: 8,
    allow_same_day: true,
    same_day_rush_fee_cents: 500,
    same_day_min_lead_minutes: 30,
    max_days_ahead: 14,
  };
});

describe("getSlotsForDate", () => {
  it("returns no slots for a closed day (Sunday)", async () => {
    const day = await getSlotsForDate("2026-05-03", REFERENCE_NOW); // Sunday
    expect(day.isOpen).toBe(false);
    expect(day.slots).toEqual([]);
  });

  it("returns no slots for a closure date even if day-of-week is open", async () => {
    store.pickup_closures = [{ closure_date: "2026-05-05", reason: "Holiday" }];
    const day = await getSlotsForDate("2026-05-05", REFERENCE_NOW); // Tuesday
    expect(day.isOpen).toBe(false);
    expect(day.isClosure).toBe(true);
    expect(day.closureReason).toBe("Holiday");
    expect(day.slots).toEqual([]);
  });

  it("produces an 8-minute slot grid between open and close times", async () => {
    const day = await getSlotsForDate("2026-05-05", REFERENCE_NOW); // Tomorrow (Tuesday)
    expect(day.isOpen).toBe(true);
    // 10am-6pm = 8 hours = 480 minutes / 8 = 60 slots
    expect(day.slots.length).toBe(60);
    expect(day.slots[0].timeKey).toBe("10:00");
    expect(day.slots[1].timeKey).toBe("10:08");
    expect(day.slots[59].timeKey).toBe("17:52");
  });

  it("marks reserved slots as unavailable with reason=reserved", async () => {
    // Pre-reserve the 10:08 slot on May 5 (Tuesday — tomorrow from our reference)
    // May 5 10:08 ET = May 5 14:08 UTC in EDT
    store.pickup_reservations = [{ pickup_at: "2026-05-05T14:08:00.000Z" }];
    const day = await getSlotsForDate("2026-05-05", REFERENCE_NOW);
    const slot = day.slots.find(s => s.timeKey === "10:08");
    expect(slot?.available).toBe(false);
    expect(slot?.reason).toBe("reserved");
  });

  it("flags same-day slots past minimum lead time as rush-fee", async () => {
    // REFERENCE_NOW is Monday 10:00 ET. Same-day slot at 10:16 (16 min out)
    // is WITHIN the 30-minute lead — so it's a rush slot with fee > 0.
    const today = formatLocalDate(REFERENCE_NOW);
    const day = await getSlotsForDate(today, REFERENCE_NOW);
    const slot = day.slots.find(s => s.timeKey === "10:16");
    // 16 min < 30 min lead => rush
    expect(slot?.available).toBe(true);
    expect(slot?.rushFeeCents).toBe(500);
  });

  it("hides slots that have already passed", async () => {
    const today = formatLocalDate(REFERENCE_NOW);
    const day = await getSlotsForDate(today, REFERENCE_NOW);
    // 10:00 has just passed (we're AT 10:00) — available === false, reason=past or closed
    const slot = day.slots[0];
    expect(slot.available).toBe(false);
  });

  it("uses pickup_schedule_ranges when present and skips gaps between ranges", async () => {
    // Split shift: Tuesday (day 2) opens 10-12, closes for lunch, reopens 14-16.
    store.pickup_schedule_ranges = [
      { id: "r1", day_of_week: 2, open_time: "10:00:00", close_time: "12:00:00", sort_order: 0 },
      { id: "r2", day_of_week: 2, open_time: "14:00:00", close_time: "16:00:00", sort_order: 1 },
    ];
    const day = await getSlotsForDate("2026-05-05", REFERENCE_NOW); // Tuesday
    // 2h morning + 2h afternoon = 4h = 240min / 8 = 30 slots
    expect(day.slots.length).toBe(30);
    // Verify a 12:00–14:00 slot is absent
    const lunchSlot = day.slots.find(s => s.timeKey === "12:00");
    expect(lunchSlot).toBeUndefined();
    // 13:52 should also NOT be there
    expect(day.slots.find(s => s.timeKey === "13:52")).toBeUndefined();
    // But 14:00 should be there (start of afternoon range)
    expect(day.slots.find(s => s.timeKey === "14:00")?.available).toBe(true);
  });
});

describe("getNextAvailableDate", () => {
  it("returns today if today has at least one available slot past lead time", async () => {
    const result = await getNextAvailableDate(REFERENCE_NOW);
    expect(result).toBe(formatLocalDate(REFERENCE_NOW));
  });

  it("skips closed Sundays and lands on the next open day", async () => {
    // Close ALL of today (Mon), tomorrow (Tue), Wed — next available should be Thursday
    store.pickup_closures = [
      { closure_date: "2026-05-04", reason: "Closed" },
      { closure_date: "2026-05-05", reason: "Closed" },
      { closure_date: "2026-05-06", reason: "Closed" },
    ];
    const result = await getNextAvailableDate(REFERENCE_NOW);
    expect(result).toBe("2026-05-07"); // Thursday
  });

  it("returns null when every day in the window is closed", async () => {
    store.pickup_schedule = store.pickup_schedule.map(d => ({ ...d, is_open: false, open_time: null, close_time: null }));
    const result = await getNextAvailableDate(REFERENCE_NOW);
    expect(result).toBeNull();
  });
});
