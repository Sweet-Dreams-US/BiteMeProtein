import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { logError } from "@/lib/log-error";
import {
  createShipment,
  priceCents,
  type EasyPostAddress,
  type EasyPostParcel,
} from "@/lib/easypost";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/admin/orders/[id]/shipping-label/rates
 *
 * Step 1 of the two-phase label flow. Creates an EasyPost shipment using
 * the order's recipient address (from Square) + parcel dims/weight from
 * the admin form, returns the available rates, and stores the
 * easypost_shipment_id on order_fulfillment so the buy step can refer to
 * it without rebuilding the request.
 *
 * Body: { weightOz: number, lengthIn: number, widthIn: number, heightIn: number }
 *   All four required. We don't pick defaults server-side because Haley
 *   should always confirm parcel dims before we pay for a label.
 *
 * Returns: { shipmentId, rates: Array<{id, carrier, service, priceCents, deliveryDays}> }
 */

interface ParcelInput {
  weightOz?: unknown;
  lengthIn?: unknown;
  widthIn?: unknown;
  heightIn?: unknown;
}

function parsePositiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Square's ShipmentDetails.recipient → EasyPost address. */
function recipientToEasyPostAddress(recipient: any): EasyPostAddress | null {
  const addr = recipient?.address;
  if (!addr?.addressLine1 || !addr?.locality || !addr?.administrativeDistrictLevel1 || !addr?.postalCode) {
    return null;
  }
  // Square uses firstName + lastName on address; recipient may also carry
  // displayName at the top level. Fall back through both shapes.
  const name =
    [addr.firstName, addr.lastName].filter(Boolean).join(" ") ||
    recipient.displayName ||
    "";
  return {
    name,
    street1: addr.addressLine1,
    street2: addr.addressLine2 || undefined,
    city: addr.locality,
    state: addr.administrativeDistrictLevel1,
    zip: addr.postalCode,
    country: addr.country || "US",
    phone: recipient.phoneNumber || undefined,
    email: recipient.emailAddress || undefined,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const { id: orderId } = await params;
    const body = (await req.json().catch(() => ({}))) as ParcelInput;

    const weightOz = parsePositiveNumber(body.weightOz);
    const lengthIn = parsePositiveNumber(body.lengthIn);
    const widthIn = parsePositiveNumber(body.widthIn);
    const heightIn = parsePositiveNumber(body.heightIn);
    if (!weightOz || !lengthIn || !widthIn || !heightIn) {
      return NextResponse.json(
        { error: "weightOz, lengthIn, widthIn, heightIn required (positive numbers)" },
        { status: 400 },
      );
    }

    const supabase = getServiceClient();

    // Pull the order's raw fulfillment so we can extract the SHIPMENT
    // recipient. EasyPost doesn't care about the rest.
    const { data: order, error: orderErr } = await supabase
      .from("square_orders")
      .select("id, raw")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) {
      await logError(orderErr, {
        path: "/api/admin/orders/[id]/shipping-label/rates",
        source: "api-route",
        context: { orderId, step: "read-order" },
      });
      return NextResponse.json({ error: "Could not read order" }, { status: 500 });
    }
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const fulfillments: any[] = order.raw?.fulfillments ?? [];
    const shipment = fulfillments.find((f) => f?.type === "SHIPMENT");
    if (!shipment) {
      return NextResponse.json(
        { error: "Order has no shipping fulfillment — is this a pickup order?" },
        { status: 400 },
      );
    }
    const toAddress = recipientToEasyPostAddress(shipment.shipmentDetails?.recipient);
    if (!toAddress) {
      return NextResponse.json(
        { error: "Recipient address missing required fields (street1/city/state/zip)" },
        { status: 400 },
      );
    }

    const parcel: EasyPostParcel = {
      length: lengthIn,
      width: widthIn,
      height: heightIn,
      weight: weightOz,
    };

    const ep = await createShipment({
      to: toAddress,
      parcel,
      reference: orderId,
    });

    // Persist the shipment ID so the buy step can refer to it without
    // rebuilding the request. Upsert against the order_fulfillment row —
    // create one if it doesn't exist (e.g. first time admin touches this
    // order). Status stays at whatever it is now; the buy endpoint flips
    // it to "shipped".
    const { error: upsertErr } = await supabase
      .from("order_fulfillment")
      .upsert(
        {
          square_order_id: orderId,
          status: "new", // ignored on conflict; only used for fresh inserts
          easypost_shipment_id: ep.id,
        },
        { onConflict: "square_order_id" },
      );
    if (upsertErr) {
      // Non-fatal — admin can still buy the label by passing the shipment
      // ID back, but log so we know about it.
      await logError(upsertErr, {
        path: "/api/admin/orders/[id]/shipping-label/rates",
        source: "api-route",
        context: { orderId, shipmentId: ep.id, step: "save-shipment-id" },
      });
    }

    return NextResponse.json({
      shipmentId: ep.id,
      rates: ep.rates.map((r) => ({
        id: r.id,
        carrier: r.carrier,
        service: r.service,
        priceCents: priceCents(r),
        deliveryDays: r.delivery_days,
        deliveryDate: r.delivery_date,
        guaranteed: r.delivery_date_guaranteed,
      })),
    });
  } catch (err) {
    await logError(err, {
      path: "/api/admin/orders/[id]/shipping-label/rates",
      source: "api-route",
    });
    const message = err instanceof Error ? err.message : "Failed to fetch rates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
