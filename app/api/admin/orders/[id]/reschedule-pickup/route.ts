import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSquareClient, getLocationId } from "@/lib/square";
import { requireAdmin } from "@/lib/admin-auth";
import { logError } from "@/lib/log-error";
import { sendPickupRescheduled } from "@/lib/customer-emails";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/admin/orders/[id]/reschedule-pickup
 *
 * Move a pickup order to a new time slot. Three coordinated updates:
 *   1. pickup_reservations.pickup_at — UNIQUE constraint protects against
 *      two admins assigning the same slot to two orders concurrently.
 *   2. Square Order fulfillments.pickup_details.pickup_at — so Haley's POS
 *      reflects the new time.
 *   3. Customer email — fire-and-forget so a Resend hiccup doesn't block.
 *
 * Body: { pickup_at: string (ISO), reason?: string }
 *   reason is shown to the customer in the email so they understand why.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const newPickupAt: unknown = body.pickup_at;
    const reason: string | undefined = typeof body.reason === "string" ? body.reason : undefined;

    if (typeof newPickupAt !== "string" || Number.isNaN(new Date(newPickupAt).getTime())) {
      return NextResponse.json({ error: "Invalid pickup_at — pass an ISO timestamp" }, { status: 400 });
    }
    const newDate = new Date(newPickupAt);
    if (newDate.getTime() < Date.now()) {
      return NextResponse.json({ error: "Pickup time can't be in the past" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Read the current reservation so we know the previous time + customer
    // contact for the notification email. We also need to verify the
    // customer hasn't already picked up (no point rescheduling).
    const { data: reservation, error: readErr } = await supabase
      .from("pickup_reservations")
      .select("pickup_at, customer_email, customer_name, status")
      .eq("square_order_id", orderId)
      .maybeSingle();

    if (readErr) {
      await logError(readErr, { path: "/api/admin/orders/[id]/reschedule-pickup:read", source: "api-route" });
      return NextResponse.json({ error: "Could not read reservation" }, { status: 500 });
    }
    if (!reservation) {
      return NextResponse.json({ error: "No pickup reservation for this order" }, { status: 404 });
    }
    if (reservation.status === "picked_up" || reservation.status === "cancelled") {
      return NextResponse.json(
        { error: `Cannot reschedule — order is already ${reservation.status}` },
        { status: 400 },
      );
    }
    const previousPickupAt = reservation.pickup_at as string;
    if (previousPickupAt === newDate.toISOString()) {
      return NextResponse.json({ error: "That's already the current pickup time" }, { status: 400 });
    }

    // Move the reservation. Two-step delete-then-insert wrapped in a
    // pseudo-transaction via service-role is safest: the unique PK on
    // pickup_at means a same-time conflict will surface as an error on
    // INSERT and we can roll back by re-inserting the old row.
    const { error: deleteErr } = await supabase
      .from("pickup_reservations")
      .delete()
      .eq("square_order_id", orderId);
    if (deleteErr) {
      await logError(deleteErr, { path: "/api/admin/orders/[id]/reschedule-pickup:delete", source: "api-route" });
      return NextResponse.json({ error: "Could not free up old slot" }, { status: 500 });
    }

    const { error: insertErr } = await supabase
      .from("pickup_reservations")
      .insert({
        pickup_at: newDate.toISOString(),
        square_order_id: orderId,
        customer_email: reservation.customer_email,
        customer_name: reservation.customer_name,
        status: reservation.status,
      });
    if (insertErr) {
      // Restore the old reservation so we don't leave the order orphaned.
      await supabase.from("pickup_reservations").insert({
        pickup_at: previousPickupAt,
        square_order_id: orderId,
        customer_email: reservation.customer_email,
        customer_name: reservation.customer_name,
        status: reservation.status,
      });
      await logError(insertErr, {
        path: "/api/admin/orders/[id]/reschedule-pickup:insert",
        source: "api-route",
        context: { orderId, attemptedAt: newDate.toISOString(), restored: true },
      });
      // 23505 = unique violation. Translate to a clean message for admin UI.
      const isConflict = (insertErr as { code?: string }).code === "23505";
      return NextResponse.json(
        {
          error: isConflict
            ? "That slot is already booked by another order. Pick a different time."
            : "Could not write new slot",
        },
        { status: isConflict ? 409 : 500 },
      );
    }

    // Update the Square order's fulfillment to match the new time. We need
    // the order's current version number for optimistic concurrency.
    try {
      const square = getSquareClient();
      const locationId = getLocationId();
      const orderResp: any = await (square.orders as any).get({ orderId });
      const sqOrder = orderResp.order ?? orderResp.result?.order;
      const fulfillments = sqOrder?.fulfillments ?? [];
      const pickupIndex = fulfillments.findIndex((f: { type?: string }) => f?.type === "PICKUP");
      if (pickupIndex >= 0) {
        const updatedFulfillment = {
          ...fulfillments[pickupIndex],
          pickupDetails: {
            ...(fulfillments[pickupIndex].pickupDetails ?? {}),
            pickupAt: newDate.toISOString(),
            scheduleType: "SCHEDULED",
          },
        };
        const newFulfillments = [...fulfillments];
        newFulfillments[pickupIndex] = updatedFulfillment;
        await (square.orders as any).update({
          orderId,
          order: {
            locationId,
            version: sqOrder.version,
            fulfillments: newFulfillments,
          },
        });
      }
    } catch (squareErr) {
      // Square update failure is logged but doesn't roll back our DB —
      // our admin UI is authoritative for the customer-facing time, and
      // Haley can manually fix Square's POS view if it drifts.
      await logError(squareErr, {
        path: "/api/admin/orders/[id]/reschedule-pickup:square-update",
        source: "api-route",
        context: { orderId, newPickupAt: newDate.toISOString() },
        level: "warn",
      });
    }

    // Fire-and-forget customer email. Pull email + total from order if
    // reservation didn't capture it (older reservations may have null).
    let customerEmail: string | null = reservation.customer_email;
    let customerName: string | null = reservation.customer_name;
    let orderTotalCents = 0;
    if (!customerEmail) {
      const { data: orderRow } = await supabase
        .from("square_orders")
        .select("total_money_cents, customer:square_customers(email, given_name, family_name), raw")
        .eq("id", orderId)
        .maybeSingle();
      const customerField = (orderRow as { customer?: unknown } | null)?.customer;
      const customer = Array.isArray(customerField) ? customerField[0] : customerField;
      const c = customer as { email?: string | null; given_name?: string | null; family_name?: string | null } | null;
      customerEmail = c?.email ?? null;
      customerName = customerName || [c?.given_name, c?.family_name].filter(Boolean).join(" ") || null;
      orderTotalCents = (orderRow as { total_money_cents?: number | null } | null)?.total_money_cents ?? 0;
    }

    if (customerEmail) {
      const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "https://bitemeprotein.com";
      sendPickupRescheduled({
        orderId,
        shortId: orderId.slice(-6).toUpperCase(),
        buyerEmail: customerEmail,
        buyerName: customerName ?? undefined,
        totalCents: orderTotalCents,
        orderType: "pickup",
        items: [],
        trackUrl: `${origin}/track?id=${encodeURIComponent(orderId)}&email=${encodeURIComponent(customerEmail)}`,
        pickupAt: newDate.toISOString(),
        previousPickupAt,
        reason,
      }).catch((emailErr) =>
        logError(emailErr, {
          path: "/api/admin/orders/[id]/reschedule-pickup:email",
          source: "api-route",
          context: { orderId },
        }),
      );
    }

    return NextResponse.json({
      ok: true,
      previousPickupAt,
      newPickupAt: newDate.toISOString(),
      emailedTo: customerEmail,
    });
  } catch (err) {
    await logError(err, { path: "/api/admin/orders/[id]/reschedule-pickup", source: "api-route" });
    return NextResponse.json({ error: "Reschedule failed" }, { status: 500 });
  }
}
