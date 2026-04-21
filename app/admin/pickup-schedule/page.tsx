"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * Admin pickup schedule manager.
 *
 * Three-section page:
 *  1. Weekly hours — one row per day, toggle is_open + set open/close time
 *  2. Closures — list of future one-off closed dates (add or remove)
 *  3. Settings — slot duration, rush fee, lead time
 *
 * Changes save via POST /api/admin/pickup-schedule, which accepts any
 * subset of { schedule, closures, settings } in one call.
 */

interface ScheduleDay {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

interface Closure {
  closure_date: string;
  reason: string | null;
}

interface Settings {
  slot_duration_minutes: number;
  allow_same_day: boolean;
  same_day_rush_fee_cents: number;
  same_day_min_lead_minutes: number;
  max_days_ahead: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toTimeInput(t: string | null): string {
  // PG returns "HH:MM:SS"; <input type="time"> wants "HH:MM"
  return t ? t.slice(0, 5) : "";
}

function fromTimeInput(t: string): string | null {
  return t ? `${t}:00` : null;
}

export default function PickupSchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [newClosureDate, setNewClosureDate] = useState("");
  const [newClosureReason, setNewClosureReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/pickup-schedule");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      setSchedule(data.schedule ?? []);
      setClosures(data.closures ?? []);
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(payload: { schedule?: ScheduleDay[]; closures?: Closure[]; settings?: Partial<Settings> }) {
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/pickup-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSavedFlash("Saved");
      setTimeout(() => setSavedFlash(null), 1800);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function updateDay(day_of_week: number, patch: Partial<ScheduleDay>) {
    setSchedule(prev => prev.map(d =>
      d.day_of_week === day_of_week ? { ...d, ...patch } : d,
    ));
  }

  async function removeClosure(date: string) {
    const remaining = closures.filter(c => c.closure_date !== date);
    setClosures(remaining);
    await save({ closures: remaining });
  }

  async function addClosure() {
    if (!newClosureDate) return;
    const next = [...closures, { closure_date: newClosureDate, reason: newClosureReason || null }];
    setClosures(next);
    setNewClosureDate("");
    setNewClosureReason("");
    await save({ closures: next });
  }

  const inputClass = "bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-3 py-2 text-[#5a3e36] text-sm focus:outline-none focus:border-[#E8A0BF] focus:ring-2 focus:ring-[#E8A0BF]/20";

  if (loading) return <div className="text-[#7a6a62]">Loading…</div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5a3e36]">Pickup hours</h1>
          <p className="text-[#7a6a62] text-sm mt-1">Set when customers can pick up orders. Rush fee applies to same-day slots.</p>
        </div>
        {savedFlash && <p className="text-green-600 text-sm font-bold">✓ {savedFlash}</p>}
      </div>

      {error && <p className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm">{error}</p>}

      {/* ── Weekly hours ────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-[#f0e6de] p-6">
        <h2 className="text-lg font-bold text-[#5a3e36] mb-4">Weekly hours</h2>
        <div className="space-y-2">
          {schedule.map(day => (
            <div key={day.day_of_week} className="grid grid-cols-[120px_80px_1fr_auto_1fr] gap-3 items-center">
              <span className="font-medium text-[#5a3e36]">{DAY_NAMES[day.day_of_week]}</span>
              <label className="flex items-center gap-2 text-sm text-[#7a6a62]">
                <input
                  type="checkbox"
                  checked={day.is_open}
                  onChange={e => updateDay(day.day_of_week, { is_open: e.target.checked })}
                  className="w-4 h-4 accent-[#E8A0BF]"
                />
                Open
              </label>
              <input
                type="time"
                value={toTimeInput(day.open_time)}
                onChange={e => updateDay(day.day_of_week, { open_time: fromTimeInput(e.target.value) })}
                disabled={!day.is_open}
                className={`${inputClass} disabled:opacity-40`}
              />
              <span className="text-[#b0a098]">to</span>
              <input
                type="time"
                value={toTimeInput(day.close_time)}
                onChange={e => updateDay(day.day_of_week, { close_time: fromTimeInput(e.target.value) })}
                disabled={!day.is_open}
                className={`${inputClass} disabled:opacity-40`}
              />
            </div>
          ))}
        </div>
        <button
          onClick={() => save({ schedule })}
          disabled={saving}
          className="mt-4 bg-[#E8A0BF] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#d889ad] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save hours"}
        </button>
      </section>

      {/* ── Closures ────────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-[#f0e6de] p-6">
        <h2 className="text-lg font-bold text-[#5a3e36] mb-4">Closed dates</h2>
        <p className="text-[#7a6a62] text-sm mb-4">Holidays, vacation, or days you just need off. Customers can&apos;t book these dates.</p>

        {closures.length === 0 ? (
          <p className="text-[#b0a098] text-sm italic">No upcoming closures.</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {closures.map(c => (
              <li key={c.closure_date} className="flex items-center gap-3 bg-[#FFF5EE] rounded-xl px-4 py-2.5">
                <span className="font-mono text-[#5a3e36]">{c.closure_date}</span>
                {c.reason && <span className="text-[#7a6a62] text-sm flex-1">— {c.reason}</span>}
                <button
                  onClick={() => removeClosure(c.closure_date)}
                  disabled={saving}
                  className="text-red-500 text-xs font-bold hover:text-red-700"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            value={newClosureDate}
            onChange={e => setNewClosureDate(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Reason (optional, e.g. 'Thanksgiving')"
            value={newClosureReason}
            onChange={e => setNewClosureReason(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button
            onClick={addClosure}
            disabled={!newClosureDate || saving}
            className="bg-[#843430] text-white px-5 py-2 rounded-xl font-bold hover:bg-[#6e2a27] disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </section>

      {/* ── Settings ────────────────────────────────────────────────────────── */}
      {settings && (
        <section className="bg-white rounded-2xl border border-[#f0e6de] p-6">
          <h2 className="text-lg font-bold text-[#5a3e36] mb-4">Pickup settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-[#7a6a62] text-xs font-bold uppercase tracking-wider mb-1.5">
                Slot duration (minutes)
              </span>
              <input
                type="number"
                min={1} max={60}
                value={settings.slot_duration_minutes}
                onChange={e => setSettings({ ...settings, slot_duration_minutes: Number(e.target.value) })}
                className={`${inputClass} w-full`}
              />
              <span className="text-[#b0a098] text-xs mt-1 block">One pickup every N minutes.</span>
            </label>

            <label className="block">
              <span className="block text-[#7a6a62] text-xs font-bold uppercase tracking-wider mb-1.5">
                Max days ahead
              </span>
              <input
                type="number"
                min={1} max={60}
                value={settings.max_days_ahead}
                onChange={e => setSettings({ ...settings, max_days_ahead: Number(e.target.value) })}
                className={`${inputClass} w-full`}
              />
              <span className="text-[#b0a098] text-xs mt-1 block">How far out customers can book.</span>
            </label>

            <label className="block">
              <span className="block text-[#7a6a62] text-xs font-bold uppercase tracking-wider mb-1.5">
                Same-day rush fee ($)
              </span>
              <input
                type="number"
                min={0} step="0.25"
                value={(settings.same_day_rush_fee_cents / 100).toFixed(2)}
                onChange={e => setSettings({ ...settings, same_day_rush_fee_cents: Math.round(Number(e.target.value) * 100) })}
                className={`${inputClass} w-full`}
              />
              <span className="text-[#b0a098] text-xs mt-1 block">Added to same-day pickup orders.</span>
            </label>

            <label className="block">
              <span className="block text-[#7a6a62] text-xs font-bold uppercase tracking-wider mb-1.5">
                Same-day lead time (minutes)
              </span>
              <input
                type="number"
                min={0} max={720}
                value={settings.same_day_min_lead_minutes}
                onChange={e => setSettings({ ...settings, same_day_min_lead_minutes: Number(e.target.value) })}
                className={`${inputClass} w-full`}
              />
              <span className="text-[#b0a098] text-xs mt-1 block">Slots sooner than this incur the rush fee.</span>
            </label>

            <label className="flex items-center gap-2 text-sm text-[#5a3e36] sm:col-span-2">
              <input
                type="checkbox"
                checked={settings.allow_same_day}
                onChange={e => setSettings({ ...settings, allow_same_day: e.target.checked })}
                className="w-4 h-4 accent-[#E8A0BF]"
              />
              Allow same-day pickups (with rush fee)
            </label>
          </div>
          <button
            onClick={() => save({ settings })}
            disabled={saving}
            className="mt-4 bg-[#E8A0BF] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#d889ad] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </section>
      )}
    </div>
  );
}
