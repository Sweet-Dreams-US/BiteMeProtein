import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { logError } from "@/lib/log-error";
import { buyLabel } from "@/lib/easypost";
import { sendCustomerEmail, type OrderEmailData } from "@/lib/customer-emails";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/admin/orders/[id]/shipping-label/buy
 *
 * Step 2 of the two-phase label flow. Buys a specific rate on the
 * EasyPost shipment created by the rates endpoint, persists the
 * tracking info + label URL on order_fulfillment, marks status=shipped,
 * and fires a customer "shipped" email with the tracking link.
 *
 * Body: { rateId: string, shipmentId: string, service?: string }
 *   - rateId: the EasyPost rate the admin chose
 *   - shipmentId: the EasyPost shipment from the rates step
 *   - service: optional human label like "FedEx Ground" (for the
 *     fulfillment row + customer email). Falls back to whatever EasyPost
 *     reports on the bought rate.
 *
 * Idempotency: refuses if the order already has a tracking_number, so a
 * double-click won't double-buy. Admin must explicitly clear tracking
 * (via a future "void label" flow) to retry.
 */

interface BuyInput {
  rateId?: unknown;
  shipmentId?: unknown;
  service?: unknown;
}

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const { id: orderId } = await params;
    const body = (await req.json().catch(() => ({}))) as BuyInput;
    const rateId = typeof body.rateId === "string" ? body.rateId : "";
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId : "";
    const overrideService = typeof body.service === "string" ? body.service : null;

    if (!rateId || !shipmentId) {
      return NextResponse.json({ error: "rateId and shipmentId required" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Idempotency: if this order already has a tracking_number, refuse.
    // Admin can clear it via a future "void" flow; we don't auto-overwrite
    // because the customer may already have received an email with the
    // old number, and double-buying costs real money.
    const { data: existing, error: existingErr } = await supabase
      .from("order_fulfillment")
      .select("tracking_number, easypost_shipment_id")
      .eq("square_order_id", orderId)
      .maybeSingle();
    if (existingErr) {
      await logError(existingErr, {
        path: "/api/admin/orders/[id]/shipping-label/buy",
        source: "api-route",
        context: { orderId, step: "read-existing" },
      });
      return NextResponse.json({ error: "Could not check existing fulfillment" }, { status: 500 });
    }
    if (existing?.tracking_number) {
      return NextResponse.json(
        { error: "Order already has a label. Void the existing label before buying a new one." },
        { status: 409 },
      );
    }
    // Defensive sanity check — if the shipmentId in the request doesn't
    // match the one we stored, log it but trust the caller. This guards
    // against a stale rates response on the admin side.
    if (existing?.easypost_shipment_id && existing.easypost_shipment_id !== shipmentId) {
      await logError(
        `Shipment ID mismatch: stored=${existing.easypost_shipment_id} sent=${shipmentId}`,
        {
          path: "/api/admin/orders/[id]/shipping-label/buy",
          source: "api-route",
          level: "warn",
          context: { orderId },
        },
      );
    }

    // Buy the label. EasyPost will charge our account and return the
    // shipment with tracking_code + postage_label populated.
    const bought = await buyLabel(shipmentId, rateId);
    if (!bought.tracking_code || !bought.postage_label?.label_url) {
      return NextResponse.json(
        { error: "EasyPost did not return tracking + label after buy. Check EasyPost dashboard." },
        { status: 502 },
      );
    }

    const cents = bought.selected_rate
      ? Math.round(parseFloat(bought.selected_rate.rate) * 100)
      : null;
    const carrier = bought.selected_rate?.carrier ?? null;
    const service = overrideService ?? bought.selected_rate?.service ?? null;

    // Persist on order_fulfillment. Upsert covers both the "rates step
    // saved a row" path and the unlikely "rates step's upsert failed but
    // buy still worked from a stored shipment ID" path.
    const { error: saveErr } = await supabase
      .from("order_fulfillment")
      .upsert(
        {
          square_order_id: orderId,
          status: "shipped",
          tracking_number: bought.tracking_code,
          carrier,
          service,
          label_url: bought.postage_label.label_url,
          easypost_shipment_id: bought.id,
          label_cost_cents: cents,
          shipped_at: new Date().toISOString(),
        },
        { onConflict: "square_order_id" },
      );
    if (saveErr) {
      // The label IS bought at this point — money is spent. Log loudly so
      // an admin can copy the tracking number from EasyPost dashboard if
      // the row save somehow failed.
      await logError(saveErr, {
        path: "/api/admin/orders/[id]/shipping-label/buy",
        source: "api-route",
        context: {
          orderId,
          shipmentId: bought.id,
          tracking: bought.tracking_code,
          labelUrl: bought.postage_label.label_url,
          step: "save-fulfillment",
        },
      });
      return NextResponse.json(
        {
          error: "Label was purchased but DB save failed. Tracking + label URL in error log.",
          tracking: bought.tracking_code,
          labelUrl: bought.postage_label.label_url,
        },
        { status: 500 },
      );
    }

    // Fire the "shipped" email — fire-and-forget per the codebase pattern.
    // Lookup runs in parallel paths so a missing email doesn't block the
    // label response.
    void (async () => {
      try {
        const { data: orderRow } = await supabase
          .from("square_orders")
          .select(`
            id, total_money_cents, raw,
            line_items:square_order_line_items(name, quantity, base_price_cents),
            customer:square_customers(email, given_name, family_name)
          `)
          .eq("id", orderId)
          .maybeSingle();

        if (!orderRow) return;
        const order: any = orderRow;
        const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
        const fulfillmentRaw = order.raw?.fulfillments?.find((f: any) => f?.type === "SHIPMENT") ?? {};
        const recipientEmail =
          customer?.email ??
          fulfillmentRaw.shipmentDetails?.recipient?.emailAddress ??
          null;
        if (!recipientEmail) return;

        const buyerName =
          [customer?.given_name, customer?.family_name].filter(Boolean).join(" ") ||
          fulfillmentRaw.shipmentDetails?.recipient?.displayName ||
          undefined;

        const data: OrderEmailData = {
          orderId: order.id,
          shortId: order.id.slice(-6).toUpperCase(),
          buyerEmail: recipientEmail,
          buyerName,
          totalCents: Number(order.total_money_cents ?? 0),
          orderType: "shipping",
          items: (order.line_items ?? []).map((li: any) => ({
            name: li.name ?? "Item",
            quantity: li.quantity ?? 1,
            priceCents: li.base_price_cents ?? undefined,
          })),
          trackUrl: buildTrackUrl(order.id, recipientEmail),
          carrier: carrier ?? undefined,
          trackingNumber: bought.tracking_code ?? undefined,
          // EasyPost gives us a public tracker URL — use it directly so
          // customers see all the carrier-agnostic timeline UI without us
          // having to deep-link per carrier.
          trackingUrl: bought.tracker?.public_url ?? undefined,
        };
        await sendCustomerEmail("shipped", data);
      } catch (err) {
        await logError(err, {
          path: "/api/admin/orders/[id]/shipping-label/buy:customer-email",
          source: "api-route",
          context: { orderId },
        });
      }
    })();

    return NextResponse.json({
      tracking: bought.tracking_code,
      labelUrl: bought.postage_label.label_url,
      carrier,
      service,
      costCents: cents,
      trackerUrl: bought.tracker?.public_url ?? null,
    });
  } catch (err) {
    await logError(err, {
      path: "/api/admin/orders/[id]/shipping-label/buy",
      source: "api-route",
    });
    const message = err instanceof Error ? err.message : "Failed to buy label";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
