import { NextRequest, NextResponse } from "next/server";
import { getSquareClient, getLocationId } from "@/lib/square";
import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log-error";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Public order tracking endpoint.
 *
 * Two-factor lookup: customer must provide BOTH an order ID AND their
 * email. This prevents enumeration attacks — guessing a 6-char ID alone
 * wouldn't expose another customer's shipping address or PII.
 *
 * GET /api/orders/track?id=<orderId>&email=<buyerEmail>
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("id")?.trim();
    const email = searchParams.get("email")?.trim().toLowerCase();

    if (!orderId || !email) {
      return NextResponse.json(
        { error: "Both order ID and email are required" },
        { status: 400 }
      );
    }

    const squareClient = getSquareClient();
    const SQUARE_LOCATION_ID = getLocationId();

    // Fetch the order from Square — handle both full IDs and short 6-char suffixes
    let order: any = null;

    if (orderId.length >= 20) {
      // Full Square order ID — use direct retrieval
      try {
        const orderResp: any = await (squareClient.orders as any).get({ orderId });
        order = orderResp.order;
      } catch {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
    } else {
      // Short ID (last 6 chars) — search recent orders for a match
      const searchResp: any = await squareClient.orders.search({
        locationIds: [SQUARE_LOCATION_ID],
        query: {
          sort: { sortField: "CREATED_AT", sortOrder: "DESC" },
          filter: {
            dateTimeFilter: {
              createdAt: {
                startAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
              },
            },
          },
        },
        limit: 200,
      });
      order = (searchResp.orders || []).find((o: any) =>
        o.id?.toLowerCase().endsWith(orderId.toLowerCase())
      );
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
    }

    // Verify email matches — look at fulfillment recipient, tenders, or customer
    const fulfillment = order.fulfillments?.[0];
    const recipientEmail = (
      fulfillment?.shipmentDetails?.recipient?.emailAddress ||
      fulfillment?.pickupDetails?.recipient?.emailAddress ||
      ""
    ).toLowerCase();

    // Also check the payment email on the linked payment
    let paymentEmail = "";
    if (order.tenders?.[0]?.paymentId) {
      try {
        const payResp: any = await (squareClient.payments as any).get({
          paymentId: order.tenders[0].paymentId,
        });
        paymentEmail = (payResp.payment?.buyerEmailAddress || "").toLowerCase();
      } catch { /* ignore */ }
    }

    if (recipientEmail !== email && paymentEmail !== email) {
      // Don't leak whether the order exists — just say not found
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Pull fulfillment status from our Supabase admin table (authenticated reads only,
    // but we use service role / anon key on server side for the lookup)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: fulfillmentRow } = await supabase
      .from("order_fulfillment")
      .select("status, tracking_number, carrier, shipped_at")
      .eq("square_order_id", order.id)
      .maybeSingle();

    // Build a sanitized customer-facing response (strip admin-only PII like internal notes)
    const response = {
      orderId: order.id,
      shortId: order.id.slice(-6).toUpperCase(),
      createdAt: order.createdAt,
      state: order.state,
      total: order.totalMoney ? {
        amount: Number(order.totalMoney.amount),
        currency: order.totalMoney.currency,
      } : null,
      items: (order.lineItems || []).map((li: any) => ({
        name: li.name,
        quantity: li.quantity,
        note: li.note || null,
      })),
      fulfillmentType: fulfillment?.type || null, // "SHIPMENT" | "PICKUP"
      shipping: fulfillment?.type === "SHIPMENT" && fulfillment.shipmentDetails?.recipient?.address ? {
        city: fulfillment.shipmentDetails.recipient.address.locality,
        state: fulfillment.shipmentDetails.recipient.address.administrativeDistrictLevel1,
        zip: fulfillment.shipmentDetails.recipient.address.postalCode,
      } : null,
      status: fulfillmentRow?.status || "new",
      trackingNumber: fulfillmentRow?.tracking_number || null,
      carrier: fulfillmentRow?.carrier || null,
      shippedAt: fulfillmentRow?.shipped_at || null,
    };

    return NextResponse.json(response);
  } catch (err) {
    await logError(err, {
      path: "/api/orders/track",
      source: "api-route",
    });
    const message = err instanceof Error ? err.message : "Failed to look up order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
