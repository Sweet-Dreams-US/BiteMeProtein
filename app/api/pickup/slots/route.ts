import { NextRequest, NextResponse } from "next/server";
import { getSlotsForDate, getNextAvailableDate, formatLocalDate, loadPickupConfig, publicSettings } from "@/lib/pickup";
import { logError } from "@/lib/log-error";

/**
 * GET /api/pickup/slots?date=YYYY-MM-DD
 *
 * Returns the slot grid for the requested date plus the earliest available
 * date across the window (so the UI can jump to it if the customer picked
 * a fully-booked or closed date).
 *
 * No auth — public endpoint used by /checkout to render the pickup picker.
 * Reservations contain customer data but we only surface aggregate
 * availability here.
 *
 * Defaults to tomorrow if no date is passed.
 */

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const requested = url.searchParams.get("date");
    const now = new Date();

    const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? requested
      : formatLocalDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));

    const day = await getSlotsForDate(date, now);
    const nextAvailable = await getNextAvailableDate(now);
    const { settings } = await loadPickupConfig();

    return NextResponse.json({
      date,
      day,
      nextAvailable,
      settings: publicSettings(settings),
    });
  } catch (err) {
    await logError(err, { path: "/api/pickup/slots", source: "api-route" });
    return NextResponse.json(
      { error: "Could not load pickup slots. Try again in a moment." },
      { status: 500 },
    );
  }
}
