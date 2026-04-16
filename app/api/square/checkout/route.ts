import { NextRequest, NextResponse } from "next/server";
import { getSquareClient, getLocationId } from "@/lib/square";
import crypto from "crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface CheckoutBundle {
  tierName: string;
  priceCents: number;
  items: { variationId: string; name: string; quantity: number }[];
}

interface CheckoutItem {
  variationId: string;
  quantity: number;
}

export async function POST(req: NextRequest) {
  try {
    const squareClient = getSquareClient();
    const SQUARE_LOCATION_ID = getLocationId();

    if (!SQUARE_LOCATION_ID) {
      return NextResponse.json({ error: "Square location not configured" }, { status: 500 });
    }

    const body = await req.json();
    const {
      bundles = [] as CheckoutBundle[],
      items = [] as CheckoutItem[],
      orderType = "pickup",
      includeShipping = false,
      shippingCostCents = 1499,
    } = body;

    const lineItems: any[] = [];

    // Bundles: use the bundle's flat price, not individual item prices
    // Each bundle becomes a single line item with a custom price
    bundles.forEach((bundle: CheckoutBundle) => {
      const itemNames = bundle.items.map((i) => `${i.name} x${i.quantity}`).join(", ");
      lineItems.push({
        quantity: "1",
        name: `${bundle.tierName}`,
        note: itemNames,
        basePriceMoney: {
          amount: BigInt(bundle.priceCents),
          currency: "USD",
        },
        itemType: "ITEM" as const,
      });
    });

    // Individual items: use their catalog price from Square
    items.forEach((item: CheckoutItem) => {
      lineItems.push({
        quantity: String(item.quantity),
        catalogObjectId: item.variationId,
        itemType: "ITEM" as const,
      });
    });

    if (lineItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Add shipping charge if shipping order
    const serviceCharges = includeShipping ? [
      {
        name: "Shipping (Flat Rate)",
        amountMoney: { amount: BigInt(shippingCostCents), currency: "USD" as const },
        calculationPhase: "SUBTOTAL_PHASE" as const,
      },
    ] : [];

    const result = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId: SQUARE_LOCATION_ID,
        lineItems,
        ...(serviceCharges.length > 0 ? { serviceCharges } : {}),
      },
      checkoutOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://bitemeprotein.com"}/shop?order=success`,
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
