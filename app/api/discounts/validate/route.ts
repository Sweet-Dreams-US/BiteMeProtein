import { NextRequest, NextResponse } from "next/server";
import { validateAndApply, type CartBundle, type CartItem } from "@/lib/discount-codes";
import { logError } from "@/lib/log-error";

/**
 * POST /api/discounts/validate
 *
 * Public endpoint — customer clicks "Apply" on /checkout. Body:
 *   { code, bundles, items, orderType, customerEmail? }
 *
 * Returns { valid: true, amountCentsSaved, summary } or
 * { valid: false, reason }.
 *
 * This endpoint is for UI feedback only. The server authoritative check
 * runs again in /api/square/pay at payment time, so nothing about the
 * customer's claimed discount can influence the actual charge.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, bundles, items, orderType, customerEmail } = body as {
      code?: string;
      bundles?: CartBundle[];
      items?: CartItem[];
      orderType?: "pickup" | "shipping";
      customerEmail?: string;
    };

    if (typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ valid: false, reason: "Enter a code" }, { status: 200 });
    }
    if (!orderType || (orderType !== "pickup" && orderType !== "shipping")) {
      return NextResponse.json({ valid: false, reason: "Choose pickup or shipping first" }, { status: 200 });
    }

    const result = await validateAndApply({
      code,
      bundles: Array.isArray(bundles) ? bundles : [],
      items: Array.isArray(items) ? items : [],
      orderType,
      customerEmail: customerEmail?.trim() || undefined,
    });

    if (result.valid) {
      return NextResponse.json({
        valid: true,
        amountCentsSaved: result.amountCentsSaved,
        summary: result.summary,
        codeLabel: result.discount.name,
      });
    }
    return NextResponse.json({ valid: false, reason: result.reason });
  } catch (err) {
    await logError(err, { path: "/api/discounts/validate", source: "api-route" });
    return NextResponse.json({ valid: false, reason: "Couldn't validate that code" }, { status: 500 });
  }
}
