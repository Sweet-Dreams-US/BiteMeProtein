import { NextResponse } from "next/server";
import { getLoyaltyProgram } from "@/lib/loyalty";

/**
 * GET /api/loyalty/program
 *
 * Returns the current loyalty program's tiers and terminology, or
 * { enabled: false } if Haley hasn't set one up yet in the Square
 * Seller Dashboard.
 */
export async function GET() {
  try {
    const program = await getLoyaltyProgram();
    if (!program) {
      return NextResponse.json({ enabled: false });
    }
    return NextResponse.json({ enabled: true, program });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load program";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
