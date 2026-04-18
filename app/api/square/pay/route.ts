import { NextRequest, NextResponse } from "next/server";
import { getSquareClient, getLocationId } from "@/lib/square";
import { notifyAdminOfOrder } from "@/lib/notifications";
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

interface PayRequest {
  sourceId: string; // Square Web Payments SDK card token
  bundles?: CheckoutBundle[];
  items?: CheckoutItem[];
  buyerEmail?: string;
  buyerPhone?: string;
  orderType: "pickup" | "shipping";
  shippingAddress?: {
    addressLine1: string;
    addressLine2?: string;
    locality: string;
    administrativeDistrictLevel1: string; // state
    postalCode: string;
    country?: string;
    firstName?: string;
    lastName?: string;
  };
  shippingService?: string;
  shippingCostCents?: number;
  verificationToken?: string;
}

/**
 * POST /api/square/pay
 *
 * Server-side flow:
 * 1. Build a Square Order with bundles + individual items + shipping
 * 2. Submit the Order
 * 3. Charge the customer's card via payments.create, referencing the order
 *
 * This replaces the hosted payment-links redirect so checkout happens
 * inside the Bite Me site.
 */
export async function POST(req: NextRequest) {
  try {
    const squareClient = getSquareClient();
    const SQUARE_LOCATION_ID = getLocationId();

    const body: PayRequest = await req.json();
    const {
      sourceId,
      bundles = [],
      items = [],
      buyerEmail,
      buyerPhone,
      orderType,
      shippingAddress,
      shippingService,
      shippingCostCents = 0,
      verificationToken,
    } = body;

    if (!sourceId) {
      return NextResponse.json({ error: "Missing payment token" }, { status: 400 });
    }

    // Build line items for the order
    const lineItems: any[] = [];

    bundles.forEach((bundle) => {
      const itemNames = bundle.items.map((i) => `${i.name} x${i.quantity}`).join(", ");
      lineItems.push({
        quantity: "1",
        name: bundle.tierName,
        note: itemNames,
        basePriceMoney: {
          amount: BigInt(bundle.priceCents),
          currency: "USD",
        },
        itemType: "ITEM" as const,
      });
    });

    items.forEach((item) => {
      lineItems.push({
        quantity: String(item.quantity),
        catalogObjectId: item.variationId,
        itemType: "ITEM" as const,
      });
    });

    if (lineItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Shipping as a service charge
    const serviceCharges = orderType === "shipping" && shippingCostCents > 0 ? [
      {
        name: shippingService ? `FedEx ${shippingService}` : "Shipping",
        amountMoney: { amount: BigInt(shippingCostCents), currency: "USD" as const },
        calculationPhase: "SUBTOTAL_PHASE" as const,
      },
    ] : [];

    // Fulfillment
    const fulfillments: any[] = [];
    if (orderType === "shipping" && shippingAddress) {
      fulfillments.push({
        type: "SHIPMENT",
        state: "PROPOSED",
        shipmentDetails: {
          recipient: {
            displayName: [shippingAddress.firstName, shippingAddress.lastName].filter(Boolean).join(" ") || undefined,
            emailAddress: buyerEmail,
            phoneNumber: buyerPhone,
            address: {
              addressLine1: shippingAddress.addressLine1,
              addressLine2: shippingAddress.addressLine2,
              locality: shippingAddress.locality,
              administrativeDistrictLevel1: shippingAddress.administrativeDistrictLevel1,
              postalCode: shippingAddress.postalCode,
              country: shippingAddress.country || "US",
            },
          },
        },
      });
    } else if (orderType === "pickup") {
      fulfillments.push({
        type: "PICKUP",
        state: "PROPOSED",
        pickupDetails: {
          recipient: {
            displayName: buyerEmail,
            emailAddress: buyerEmail,
            phoneNumber: buyerPhone,
          },
          scheduleType: "ASAP",
          pickupAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          note: "Customer pickup at Bite Me kitchen",
        },
      });
    }

    // 1. Create the order
    const orderResp: any = await (squareClient.orders as any).create({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId: SQUARE_LOCATION_ID,
        lineItems,
        ...(serviceCharges.length > 0 ? { serviceCharges } : {}),
        ...(fulfillments.length > 0 ? { fulfillments } : {}),
      },
    });

    const orderId = orderResp.order?.id;
    const totalCents = orderResp.order?.totalMoney?.amount;
    if (!orderId || !totalCents) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    // 2. Charge the card referencing the order
    const paymentResp: any = await (squareClient.payments as any).create({
      idempotencyKey: crypto.randomUUID(),
      sourceId,
      locationId: SQUARE_LOCATION_ID,
      orderId,
      amountMoney: {
        amount: BigInt(totalCents),
        currency: "USD",
      },
      buyerEmailAddress: buyerEmail,
      ...(verificationToken ? { verificationToken } : {}),
      ...(orderType === "shipping" && shippingAddress ? {
        shippingAddress: {
          addressLine1: shippingAddress.addressLine1,
          addressLine2: shippingAddress.addressLine2,
          locality: shippingAddress.locality,
          administrativeDistrictLevel1: shippingAddress.administrativeDistrictLevel1,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country || "US",
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
        },
      } : {}),
      autocomplete: true,
    });

    const payment = paymentResp.payment;

    // Fire-and-forget admin notification (doesn't block the response)
    // If email fails, order still succeeds — data lives in Square + Supabase
    notifyAdminOfOrder({
      orderId,
      paymentId: payment?.id,
      totalCents: Number(totalCents),
      buyerName: [shippingAddress?.firstName, shippingAddress?.lastName].filter(Boolean).join(" ") || undefined,
      buyerEmail,
      buyerPhone,
      orderType,
      shippingService,
      shippingAddress: shippingAddress ? {
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2,
        locality: shippingAddress.locality,
        administrativeDistrictLevel1: shippingAddress.administrativeDistrictLevel1,
        postalCode: shippingAddress.postalCode,
      } : undefined,
      bundles: bundles.map((b) => ({
        tierName: b.tierName,
        priceCents: b.priceCents,
        items: b.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      })),
      items: items.map((i) => ({
        name: i.variationId, // we'd need to look up the name from Square — for now use variationId
        quantity: i.quantity,
      })),
    }).catch(() => { /* already logged inside */ });

    return NextResponse.json({
      success: true,
      paymentId: payment?.id,
      orderId,
      status: payment?.status,
      receiptUrl: payment?.receiptUrl,
    });
  } catch (error: any) {
    // Square SDK surfaces error arrays on failed requests
    const squareErrors = error?.errors || error?.body?.errors;
    const message = squareErrors?.[0]?.detail
      || squareErrors?.[0]?.code
      || (error instanceof Error ? error.message : "Payment failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
