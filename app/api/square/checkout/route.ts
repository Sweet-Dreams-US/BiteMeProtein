import { NextRequest, NextResponse } from "next/server";
import { squareClient, SQUARE_LOCATION_ID } from "@/lib/square";
import crypto from "crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, orderType = "pickup", includeShipping = false, shippingCostCents = 1499 } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const lineItems = items.map(
      (item: { variationId: string; quantity: number }) => ({
        quantity: String(item.quantity),
        catalogObjectId: item.variationId,
        itemType: "ITEM" as const,
      })
    );

    // Add shipping charge if shipping order
    const serviceCharges = includeShipping ? [
      {
        name: "Shipping (Flat Rate)",
        amountMoney: { amount: BigInt(shippingCostCents), currency: "USD" as const },
        calculationPhase: "SUBTOTAL_PHASE" as const,
      },
    ] : [];

    const result = await (squareClient.checkout as any).paymentLinks.create({
      idempotencyKey: crypto.randomUUID(),
      order: {
        order: {
          locationId: SQUARE_LOCATION_ID,
          lineItems,
          ...(serviceCharges.length > 0 ? { serviceCharges } : {}),
        },
      },
      checkoutOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://bite-me-protein.vercel.app"}/shop?order=success`,
        askForShippingAddress: orderType === "shipping",
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: result.paymentLink?.url,
      orderId: result.paymentLink?.orderId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
