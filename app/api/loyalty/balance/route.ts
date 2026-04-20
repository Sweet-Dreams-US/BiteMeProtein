import { NextRequest, NextResponse } from "next/server";
import { getLoyaltyBalance, getLoyaltyProgram } from "@/lib/loyalty";
import { logError } from "@/lib/log-error";

/**
 * GET /api/loyalty/balance?phone=+15551234567
 *
 * Customer-facing: looks up points balance for a phone number.
 * Safe because only showing aggregate points (no PII beyond what the
 * customer already provided).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone")?.trim();

    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const [balance, program] = await Promise.all([
      getLoyaltyBalance(phone),
      getLoyaltyProgram(),
    ]);

    if (!program) {
      return NextResponse.json({ enabled: false });
    }

    return NextResponse.json({
      enabled: true,
      balance: balance?.points ?? 0,
      lifetimePoints: balance?.lifetimePoints ?? 0,
      terminology: program.terminology,
      rewardTiers: program.rewardTiers,
    });
  } catch (err) {
    await logError(err, {
      path: "/api/loyalty/balance",
      source: "api-route",
    });
    const message = err instanceof Error ? err.message : "Failed to look up balance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
