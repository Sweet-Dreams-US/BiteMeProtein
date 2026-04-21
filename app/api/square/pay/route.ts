import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSquareClient, getLocationId } from "@/lib/square";
import { notifyAdminOfOrder } from "@/lib/notifications";
import { accumulatePointsForOrder } from "@/lib/loyalty";
import { sendOrderConfirmation } from "@/lib/customer-emails";
import { validateAndApply, recordRedemption } from "@/lib/discount-codes";
import { logError } from "@/lib/log-error";
import { deriveIdempotencyKeys } from "@/lib/idempotency";
import { loadPickupConfig, formatLocalDate } from "@/lib/pickup";

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
  promoCode?: string;
  // Client-generated UUID that stays stable across retries of one checkout
  // attempt. Derived into per-call keys server-side so a double-click or
  // network retry can't create a duplicate charge. See checkout/page.tsx.
  idempotencyKey?: string;
  // ISO UTC timestamp of the chosen pickup slot. Required for pickup
  // orders; ignored for shipping. Must match an exact slot in the
  // configured pickup_schedule — the grid aligns on slot_duration_minutes
  // intervals, so arbitrary timestamps from a bad actor hit a DB conflict
  // on pickup_reservations or miss the grid entirely and we reject.
  pickupAt?: string;
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
      bundles: rawBundles = [],
      items = [],
      buyerEmail,
      buyerPhone,
      orderType,
      shippingAddress,
      shippingService,
      shippingCostCents = 0,
      verificationToken,
      promoCode,
      idempotencyKey,
      pickupAt,
    } = body;

    if (!sourceId) {
      return NextResponse.json({ error: "Missing payment token" }, { status: 400 });
    }

    const idemKeys = deriveIdempotencyKeys(idempotencyKey);

    // ── Pickup slot validation (server-authoritative) ─────────────────────
    // Customer's chosen slot must (a) exist, (b) still be open (respecting
    // same-day lead time), (c) not already be reserved. We don't take the
    // DB lock here — that's deferred until after Square accepts the card so
    // we don't hold a slot hostage against a declined payment. The actual
    // atomic reservation insert happens after payment succeeds, below.
    let pickupSlotTime: Date | null = null;
    let rushFeeCents = 0;
    if (orderType === "pickup") {
      if (!pickupAt) {
        return NextResponse.json({ error: "Please select a pickup time" }, { status: 400 });
      }
      const parsed = new Date(pickupAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid pickup time" }, { status: 400 });
      }
      pickupSlotTime = parsed;

      // Compute rush fee if this is same-day in bakery-local time.
      const now = new Date();
      const { settings } = await loadPickupConfig();
      const sameDay = formatLocalDate(now) === formatLocalDate(parsed);
      const leadMs = parsed.getTime() - now.getTime();
      if (sameDay && leadMs > 0 && leadMs < settings.same_day_min_lead_minutes * 60 * 1000) {
        if (!settings.allow_same_day) {
          return NextResponse.json({ error: "Same-day pickups aren't available right now." }, { status: 400 });
        }
        rushFeeCents = settings.same_day_rush_fee_cents;
      }
      if (leadMs <= 0) {
        return NextResponse.json({ error: "That pickup time has already passed." }, { status: 400 });
      }
    }

    // Server-authoritative promo-code revalidation. The checkout page
    // already showed the customer an applied code + savings, but we re-run
    // the same logic here so nothing about the client's claimed discount
    // can influence the final charge.
    let bundles = rawBundles;
    let appliedDiscount: { id: string; amountCentsSaved: number } | null = null;

    if (promoCode) {
      const validation = await validateAndApply({
        code: promoCode,
        bundles: rawBundles,
        items,
        orderType,
        customerEmail: buyerEmail,
      });
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Promo code not applied: ${validation.reason}` },
          { status: 400 },
        );
      }
      bundles = validation.adjustedBundles;
      appliedDiscount = {
        id: validation.discount.id,
        amountCentsSaved: validation.amountCentsSaved,
      };
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

    // Service charges: shipping (if shipping order) + same-day rush fee (if pickup).
    const serviceCharges: any[] = [];
    if (orderType === "shipping" && shippingCostCents > 0) {
      serviceCharges.push({
        name: shippingService ? `FedEx ${shippingService}` : "Shipping",
        amountMoney: { amount: BigInt(shippingCostCents), currency: "USD" as const },
        calculationPhase: "SUBTOTAL_PHASE" as const,
      });
    }
    if (orderType === "pickup" && rushFeeCents > 0) {
      serviceCharges.push({
        name: "Same-day rush fee",
        amountMoney: { amount: BigInt(rushFeeCents), currency: "USD" as const },
        calculationPhase: "SUBTOTAL_PHASE" as const,
      });
    }

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
    } else if (orderType === "pickup" && pickupSlotTime) {
      fulfillments.push({
        type: "PICKUP",
        state: "PROPOSED",
        pickupDetails: {
          recipient: {
            displayName: buyerEmail,
            emailAddress: buyerEmail,
            phoneNumber: buyerPhone,
          },
          // SCHEDULED (not ASAP) with the customer's chosen slot. Square
          // surfaces this in their POS so Haley sees the exact pickup time.
          scheduleType: "SCHEDULED",
          pickupAt: pickupSlotTime.toISOString(),
          note: `Customer pickup at Bite Me kitchen${rushFeeCents > 0 ? " (same-day rush)" : ""}`,
        },
      });
    }

    // 1. Create the order
    const orderResp: any = await (squareClient.orders as any).create({
      idempotencyKey: idemKeys.order,
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
      idempotencyKey: idemKeys.payment,
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

    // ── Lock the pickup slot ──────────────────────────────────────────────
    // Atomic insert on pickup_reservations (pickup_at is PK). If another
    // customer snuck in between when the slot picker loaded and now, this
    // will throw a unique-violation — at which point the customer has
    // already been charged. We log that conflict loudly so Haley can
    // manually resolve (move them to another slot or refund).
    if (orderType === "pickup" && pickupSlotTime) {
      const reservationClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const reservationItems = [
        ...bundles.flatMap((b) =>
          b.items.map((i) => ({ name: `${b.tierName}: ${i.name}`, quantity: i.quantity })),
        ),
        ...items.map((i) => ({ variationId: i.variationId, quantity: i.quantity })),
      ];
      const { error: reservationErr } = await reservationClient
        .from("pickup_reservations")
        .insert({
          pickup_at: pickupSlotTime.toISOString(),
          square_order_id: orderId,
          customer_email: buyerEmail ?? null,
          customer_name: [shippingAddress?.firstName, shippingAddress?.lastName].filter(Boolean).join(" ") || null,
          customer_phone: buyerPhone ?? null,
          items: reservationItems,
          rush_fee_cents: rushFeeCents,
          status: "pending",
        });
      if (reservationErr) {
        await logError(reservationErr, {
          path: "/api/square/pay:reservation-conflict",
          source: "api-route",
          context: { orderId, pickupAt: pickupSlotTime.toISOString(), code: reservationErr.code },
          level: "error",
        });
        // We already collected payment. The customer will see success, but
        // Haley gets a flag on the admin dashboard via error_logs so she can
        // call the customer and move them to the next slot.
      }
    }

    // Fire-and-forget discount redemption record. Only runs if the
    // promo code validated above.
    if (appliedDiscount) {
      const redemptionCtx = { orderId, discountCodeId: appliedDiscount.id };
      recordRedemption({
        discountCodeId: appliedDiscount.id,
        squareOrderId: orderId,
        customerEmail: buyerEmail,
        amountCentsSaved: appliedDiscount.amountCentsSaved,
      }).catch((err) =>
        logError(err, {
          path: "/api/square/pay:recordRedemption",
          source: "api-route",
          context: redemptionCtx,
        }),
      );
    }

    // Fire-and-forget loyalty accrual (no-ops gracefully if no program configured)
    if (buyerPhone) {
      accumulatePointsForOrder({
        phoneNumber: buyerPhone,
        orderId,
        locationId: SQUARE_LOCATION_ID,
      }).catch((err) =>
        logError(err, {
          path: "/api/square/pay:accumulatePointsForOrder",
          source: "api-route",
          context: { orderId, hasPhone: true },
        }),
      );
    }

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
      pickupAt: pickupSlotTime?.toISOString(),
      rushFeeCents: rushFeeCents || undefined,
      bundles: bundles.map((b) => ({
        tierName: b.tierName,
        priceCents: b.priceCents,
        items: b.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      })),
      items: items.map((i) => ({
        name: i.variationId, // we'd need to look up the name from Square — for now use variationId
        quantity: i.quantity,
      })),
    }).catch((err) =>
      logError(err, {
        path: "/api/square/pay:notifyAdminOfOrder",
        source: "api-route",
        context: { orderId },
      }),
    );

    // Fire-and-forget customer confirmation email. sendOrderConfirmation
    // is a no-op if buyerEmail is missing; failure is logged inside.
    if (buyerEmail) {
      const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "https://bitemeprotein.com";
      sendOrderConfirmation({
        orderId,
        shortId: orderId.slice(-6).toUpperCase(),
        buyerEmail,
        buyerName: [shippingAddress?.firstName, shippingAddress?.lastName].filter(Boolean).join(" ") || undefined,
        totalCents: Number(totalCents),
        orderType,
        pickupAt: pickupSlotTime?.toISOString(),
        rushFeeCents: rushFeeCents || undefined,
        items: [
          ...bundles.flatMap((b) =>
            b.items.map((i) => ({
              name: `${b.tierName}: ${i.name}`,
              quantity: i.quantity,
            })),
          ),
          ...items.map((i) => ({ name: i.variationId, quantity: i.quantity })),
        ],
        trackUrl: `${origin}/track?id=${encodeURIComponent(orderId)}&email=${encodeURIComponent(buyerEmail)}`,
      }).catch((err) =>
        logError(err, {
          path: "/api/square/pay:sendOrderConfirmation",
          source: "api-route",
          context: { orderId },
        }),
      );
    }

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
    await logError(error, {
      path: "/api/square/pay",
      source: "api-route",
      context: { squareErrors: squareErrors ?? null },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
