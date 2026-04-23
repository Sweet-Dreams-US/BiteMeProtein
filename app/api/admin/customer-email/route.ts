import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { logError } from "@/lib/log-error";
import {
  sendCustomerEmail,
  carrierTrackingUrl,
  type CustomerEmailType,
  type OrderEmailData,
} from "@/lib/customer-emails";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/admin/customer-email
 *
 * Admin-gated. Sends a customer-facing transactional email for a specific
 * order + type. Called both:
 *   - automatically by /admin/orders when Haley saves a status change
 *   - manually from the "Resend" dropdown in the order detail modal
 *
 * Body: { orderId: string, type: "confirmation"|"preparing"|"shipped"|"delivered"|"refunded" }
 *
 * Fire-and-forget internally (sendCustomerEmail never throws). We return
 * success:true unless we couldn't build the data (missing order / missing
 * buyer email).
 */

const VALID_TYPES: CustomerEmailType[] = ["confirmation", "preparing", "shipped", "delivered", "refunded"];

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function buildTrackUrl(orderId: string, email: string): string {
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "https://bitemeprotein.com";
  return `${origin}/track?id=${encodeURIComponent(orderId)}&email=${encodeURIComponent(email)}`;
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const { orderId, type } = body as { orderId?: string; type?: string };

    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });
    if (!type || !VALID_TYPES.includes(type as CustomerEmailType)) {
      return NextResponse.json(
        { error: `type must be one of ${VALID_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    const supabase = getServiceClient();

    // Pull order + line items + customer + fulfillment
    const [orderRes, fulfillmentRes] = await Promise.all([
      supabase
        .from("square_orders")
        .select(`
          id, total_money_cents, customer_id, raw,
          line_items:square_order_line_items(name, quantity, base_price_cents),
          customer:square_customers(email, given_name, family_name)
        `)
        .eq("id", orderId)
        .maybeSingle(),
      supabase
        .from("order_fulfillment")
        .select("tracking_number, carrier")
        .eq("square_order_id", orderId)
        .maybeSingle(),
    ]);

    if (orderRes.error) {
      await logError(orderRes.error, {
        path: "/api/admin/customer-email",
        source: "api-route",
        context: { orderId, type },
      });
      return NextResponse.json({ error: orderRes.error.message }, { status: 500 });
    }

    const order: any = orderRes.data;
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Customer can come from the joined row OR from the order's raw payload
    // (anonymous checkout may not have a customer_id in Square).
    const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
    const raw = order.raw ?? {};
    const fulfillmentRaw = raw.fulfillments?.[0] ?? {};
    const recipientEmail =
      customer?.email ??
      fulfillmentRaw.shipmentDetails?.recipient?.emailAddress ??
      fulfillmentRaw.pickupDetails?.recipient?.emailAddress ??
      null;

    if (!recipientEmail) {
      return NextResponse.json(
        { sent: false, reason: "No customer email on file for this order" },
        { status: 200 },
      );
    }

    const buyerName =
      [customer?.given_name, customer?.family_name].filter(Boolean).join(" ") ||
      fulfillmentRaw.shipmentDetails?.recipient?.displayName ||
      fulfillmentRaw.pickupDetails?.recipient?.displayName ||
      undefined;

    const fulfillment = fulfillmentRes.data as { tracking_number?: string; carrier?: string } | null;
    const trackingUrl = carrierTrackingUrl(fulfillment?.carrier, fulfillment?.tracking_number) ?? undefined;

    const orderType: "pickup" | "shipping" =
      fulfillmentRaw.type === "SHIPMENT" ? "shipping" : "pickup";

    const data: OrderEmailData = {
      orderId: order.id,
      shortId: order.id.slice(-6).toUpperCase(),
      buyerEmail: recipientEmail,
      buyerName,
      totalCents: Number(order.total_money_cents ?? 0),
      orderType,
      items: (order.line_items ?? []).map((li: any) => ({
        name: li.name ?? "Item",
        quantity: li.quantity ?? 1,
        priceCents: li.base_price_cents ?? undefined,
      })),
      trackUrl: buildTrackUrl(order.id, recipientEmail),
      carrier: fulfillment?.carrier ?? undefined,
      trackingNumber: fulfillment?.tracking_number ?? undefined,
      trackingUrl,
    };

    await sendCustomerEmail(type as CustomerEmailType, data);

    return NextResponse.json({ sent: true });
  } catch (err) {
    await logError(err, { path: "/api/admin/customer-email", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to send customer email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
