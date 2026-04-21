"use client";

import { useEffect, useState, useMemo } from "react";

/**
 * Pickup date + time slot picker used in /checkout.
 *
 * Calls /api/pickup/availability for a 14-day overview (date grid colors),
 * then /api/pickup/slots?date=... for the fine-grained slot grid when the
 * customer selects a date. The callback `onSelect` receives the chosen
 * ISO timestamp and the rush fee if applicable.
 *
 * Same-day rush slots are marked visually so the customer knows why there's
 * an extra fee. Booked + past slots are visible but disabled so Haley's
 * capacity is legible ("oh, there's only 10:00 left").
 */

interface PickupSlot {
  pickupAt: string;
  display: string;
  timeKey: string;
  available: boolean;
  reason?: "reserved" | "past" | "closed";
  rushFeeCents: number;
}

interface AvailabilityDay {
  date: string;
  isOpen: boolean;
  isClosure: boolean;
  closureReason?: string;
  hasAnyAvailable: boolean;
  slotCount: number;
  reservedCount: number;
}

export interface PickupSelection {
  pickupAt: string;
  display: string;
  rushFeeCents: number;
}

interface Props {
  value: PickupSelection | null;
  onChange: (selection: PickupSelection | null) => void;
}

function formatLocalDateLabel(dateStr: string): string {
  // Render a YYYY-MM-DD as "Mon · Apr 22" in the bakery's TZ.
  const [y, m, d] = dateStr.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, 17, 0, 0)); // noon-ish ET
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short", month: "short", day: "numeric",
  }).format(probe);
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PickupPicker({ value, onChange }: Props) {
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slotData, setSlotData] = useState<{ date: string; slots: PickupSlot[] } | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) On mount: fetch 14-day availability + pick the earliest open date as default.
  useEffect(() => {
    let cancelled = false;
    setLoadingAvail(true);
    fetch("/api/pickup/availability?days=14")
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const days = (data.days ?? []) as AvailabilityDay[];
        setAvailability(days);
        if (!selectedDate) {
          const firstAvail = days.find(d => d.hasAnyAvailable);
          if (firstAvail) setSelectedDate(firstAvail.date);
        }
      })
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoadingAvail(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) When selectedDate changes, fetch the slot grid for that date.
  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setLoadingSlots(true);
    setError(null);
    fetch(`/api/pickup/slots?date=${encodeURIComponent(selectedDate)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) { setError(data.error); setSlotData(null); return; }
        setSlotData({ date: data.date, slots: data.day.slots as PickupSlot[] });
      })
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => { cancelled = true; };
  }, [selectedDate]);

  // Clear the parent selection if the date changed away from the selected slot
  useEffect(() => {
    if (value && slotData && selectedDate !== slotData.date) return; // different fetch result, ignore
    if (!value) return;
    if (!slotData) return;
    // If the previously-chosen slot is no longer in the current slot grid, clear
    const stillValid = slotData.slots.some(s => s.pickupAt === value.pickupAt);
    if (!stillValid) onChange(null);
  }, [slotData, value, onChange, selectedDate]);

  const selectSlot = (slot: PickupSlot) => {
    if (!slot.available) return;
    onChange({ pickupAt: slot.pickupAt, display: slot.display, rushFeeCents: slot.rushFeeCents });
  };

  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  }, []);

  return (
    <div className="space-y-4">
      {/* Date grid: horizontally scrollable pill list */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-dark/50 mb-2">
          Pickup date
        </p>
        {loadingAvail ? (
          <p className="text-dark/40 text-sm">Loading available dates…</p>
        ) : availability.length === 0 ? (
          <p className="text-red-500 text-sm">No pickup dates available.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {availability.map(day => {
              const isSel = day.date === selectedDate;
              const disabled = !day.hasAnyAvailable;
              const isToday = day.date === todayStr;
              const label = isToday ? "Today" : formatLocalDateLabel(day.date);
              return (
                <button
                  key={day.date}
                  onClick={() => !disabled && setSelectedDate(day.date)}
                  disabled={disabled}
                  title={day.isClosure ? `Closed: ${day.closureReason ?? ""}` : !day.isOpen ? "Closed" : undefined}
                  className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    isSel
                      ? "bg-[#E8A0BF] text-white border-[#E8A0BF]"
                      : disabled
                      ? "bg-[#FFF9F4] text-dark/30 border-[#f0e6de] cursor-not-allowed"
                      : "bg-[#FFF9F4] text-dark/80 border-[#e8ddd4] hover:border-[#E8A0BF]"
                  }`}
                >
                  <div className="whitespace-nowrap">{label}</div>
                  {disabled && (
                    <div className="text-[10px] font-normal opacity-70 mt-0.5">
                      {day.isClosure ? "closed" : !day.isOpen ? "closed" : "full"}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Slot grid for selected date */}
      {selectedDate && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-dark/50 mb-2">
            Pickup time
          </p>
          {loadingSlots ? (
            <p className="text-dark/40 text-sm">Loading times…</p>
          ) : error ? (
            <p className="text-red-500 text-sm">{error}</p>
          ) : !slotData || slotData.slots.length === 0 ? (
            <p className="text-dark/40 text-sm">No slots for this day.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto p-1">
              {slotData.slots.map(slot => {
                const isSel = value?.pickupAt === slot.pickupAt;
                return (
                  <button
                    key={slot.pickupAt}
                    onClick={() => selectSlot(slot)}
                    disabled={!slot.available}
                    title={slot.reason === "reserved" ? "Already taken" : slot.reason === "past" ? "Past" : undefined}
                    className={`py-2 px-1 rounded-lg text-xs font-bold transition-all border text-center ${
                      isSel
                        ? "bg-[#843430] text-white border-[#843430]"
                        : !slot.available
                        ? "bg-[#FFF9F4] text-dark/25 border-[#f0e6de] line-through cursor-not-allowed"
                        : slot.rushFeeCents > 0
                        ? "bg-[#FFF0F5] text-burgundy border-[#E8A0BF]/60 hover:bg-[#FFE0EC]"
                        : "bg-[#FFF9F4] text-dark/80 border-[#e8ddd4] hover:border-[#E8A0BF]"
                    }`}
                  >
                    {slot.display}
                    {slot.rushFeeCents > 0 && slot.available && (
                      <div className="text-[10px] font-normal mt-0.5 opacity-80">
                        rush +{formatUsd(slot.rushFeeCents)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation strip */}
      {value && (
        <div className="bg-[#FFF0F5] border border-[#E8A0BF]/40 rounded-xl p-3 text-sm text-burgundy">
          <strong>Picked up:</strong> {formatLocalDateLabel(selectedDate ?? "")} at {value.display}
          {value.rushFeeCents > 0 && (
            <span className="block text-xs text-dark/60 mt-0.5">
              +{formatUsd(value.rushFeeCents)} same-day rush fee included in total
            </span>
          )}
        </div>
      )}
    </div>
  );
}
