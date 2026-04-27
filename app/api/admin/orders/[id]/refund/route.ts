import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { logError } from "@/lib/log-error";
import { stripBigInts } from "@/lib/sync/json-safe";
import { sendOrderRefunded } from "@/lib/customer-emails";

/**
 * Square REST refund call — bypasses the SDK because Square SDK v44's
 * refunds module requires BigInt as input AND fails to JSON-stringify
 * BigInt without a polyfill. Adding the polyfill globally breaks the
 * checkout endpoint where Square's API expects numeric JSON. REST takes
 * a plain Number and just works.
 */
async function squareRefundPayment(input: {
  idempotencyKey: string;
  paymentId: string;
  amountCents: number;
  reason: string;
}): Promise<{ refund: any; error?: string }> {
  const token = process.env.SQUARE_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN not configured");
  const res = await fetch("https://connect.squareup.com/v2/refunds", {
    method: "POST",
    headers: {
      "Square-Version": "2024-10-17",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      payment_id: input.paymentId,
      amount_money: { amount: input.amountCents, currency: "USD" },
      reason: input.reason,
    }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.errors?.[0]?.detail
      ?? body?.errors?.[0]?.code
      ?? `Square ${res.status}`;
    return { refund: null, error: detail };
  }
  return { refund: body.refund };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/admin/orders/[id]/refund
 *
 * Admin-initiated refund. Finds the order's payment, calls Square's
 * CreateRefund, records an order_refund_initiations row, and returns the
 * created refund. Partial refunds are supported via optional amount_cents;
 * if omitted we refund the full amount.
 *
 * Body: { amount_cents?: number, reason?: string }
 *
 * The Square webhook for refund.created fires asynchronously — our
 * square_refunds table (which drives the admin "Refunded" pill) will
 * populate from that webhook. The initiation row exists so the admin UI
 * can show "pending refund" immediately without waiting for the webhook.
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
    const reason: string = (typeof body.reason === "string" && body.reason) || "admin refund";

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Need the payment id + original amount. Pull from square_payments first;
    // if absent, fall back to the order's raw.tenders for the payment id.
    const { data: paymentRow } = await supabase
      .from("square_payments")
      .select("id, amount_cents")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let paymentId: string | null = paymentRow?.id ?? null;
    let originalAmountCents: number | null = paymentRow?.amount_cents ?? null;

    if (!paymentId) {
      const { data: orderRow } = await supabase
        .from("square_orders")
        .select("raw, total_money_cents")
        .eq("id", orderId)
        .maybeSingle();
      const raw = (orderRow as { raw?: any; total_money_cents?: number } | null)?.raw;
      const tenders = raw?.tenders ?? raw?.order?.tenders ?? [];
      if (Array.isArray(tenders) && tenders[0]?.paymentId) {
        paymentId = tenders[0].paymentId;
      }
      originalAmountCents = orderRow?.total_money_cents ?? null;
    }

    if (!paymentId) {
      return NextResponse.json(
        { error: "Could not find a payment for this order. Refund in Square Dashboard directly." },
        { status: 400 },
      );
    }

    const amountCents = typeof body.amount_cents === "number"
      ? Math.max(1, Math.floor(body.amount_cents))
      : originalAmountCents;

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json({ error: "Could not determine refund amount" }, { status: 400 });
    }

    // Create the initiation row FIRST so the admin UI sees "pending" even
    // before Square responds. Status will be updated to 'completed' or
    // 'failed' based on the API call below.
    const { data: initiation, error: initErr } = await supabase
      .from("order_refund_initiations")
      .insert({
        square_order_id: orderId,
        square_payment_id: paymentId,
        amount_cents: amountCents,
        status: "pending",
      })
      .select("id")
      .single();
    if (initErr) throw initErr;

    try {
      // Direct REST instead of SDK — see squareRefundPayment() above for why.
      const { refund, error: restErr } = await squareRefundPayment({
        idempotencyKey: crypto.randomUUID(),
        paymentId,
        amountCents,
        reason,
      });
      if (restErr || !refund) {
        throw new Error(restErr ?? "Square returned no refund");
      }
      const refundId = refund?.id;

      // Mark initiation completed. The eventual webhook will also populate
      // square_refunds with the canonical row.
      await supabase
        .from("order_refund_initiations")
        .update({
          status: "completed",
          square_refund_id: refundId ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", initiation.id);

      // Seed square_refunds optimistically so the admin "Refunded" pill shows
      // immediately without waiting for the webhook echo. Idempotent on id.
      if (refundId) {
        await supabase.from("square_refunds").upsert({
          id: refundId,
          payment_id: paymentId,
          order_id: orderId,
          // REST returns snake_case (created_at). SDK returned camelCase
          // (createdAt). Reading both keeps this working if we ever swap
          // back to the SDK.
          created_at: refund?.created_at ?? refund?.createdAt ?? new Date().toISOString(),
          amount_cents: amountCents,
          reason,
          status: refund?.status ?? "PENDING",
          raw: stripBigInts(refund),
          synced_at: new Date().toISOString(),
        }, { onConflict: "id" });
      }

      // Fire-and-forget branded refund email to the customer. Failures land
      // in error_logs but don't fail the admin request — the refund itself
      // already succeeded at Square.
      const { data: orderForEmail } = await supabase
        .from("square_orders")
        .select("id, customer_id, total_money_cents, raw, customer:square_customers(email, given_name, family_name)")
        .eq("id", orderId)
        .maybeSingle();

      if (orderForEmail) {
        // Pull buyer email from the customer row OR from the raw order's
        // fulfillment recipient (covers orders placed before we synced the
        // customer record).
        const rawOrder = (orderForEmail as { raw?: any }).raw ?? {};
        const fulfillments = rawOrder.fulfillments ?? rawOrder.order?.fulfillments ?? [];
        const fulfillmentRecipient = Array.isArray(fulfillments)
          ? fulfillments[0]?.shipmentDetails?.recipient ?? fulfillments[0]?.pickupDetails?.recipient
          : null;

        const customerField = (orderForEmail as { customer?: unknown }).customer;
        const customerRow = Array.isArray(customerField) ? customerField[0] : customerField;
        const typed = customerRow as { email?: string | null; given_name?: string | null; family_name?: string | null } | null;

        const buyerEmail: string | undefined =
          typed?.email ?? fulfillmentRecipient?.emailAddress ?? undefined;

        if (buyerEmail) {
          const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "https://bitemeprotein.com";
          sendOrderRefunded({
            orderId,
            shortId: orderId.slice(-6).toUpperCase(),
            buyerEmail,
            buyerName: [typed?.given_name, typed?.family_name].filter(Boolean).join(" ") || fulfillmentRecipient?.displayName || undefined,
            totalCents: (orderForEmail as { total_money_cents?: number | null }).total_money_cents ?? amountCents,
            orderType: Array.isArray(fulfillments) && fulfillments.some((f: { type?: string }) => f?.type === "PICKUP")
              ? "pickup"
              : "shipping",
            items: [],
            trackUrl: `${origin}/track?id=${encodeURIComponent(orderId)}&email=${encodeURIComponent(buyerEmail)}`,
            refundAmountCents: amountCents,
          }).catch((emailErr) =>
            logError(emailErr, {
              path: "/api/admin/orders/[id]/refund:email",
              source: "api-route",
              context: { orderId, refundId },
            }),
          );
        }
      }

      // Sanitize the refund object before returning — Square's SDK
      // response contains BigInt money values, and Next.js JSON.stringify
      // throws on BigInt. Without stripBigInts the whole admin-facing
      // refund flow shows a "do not know how to serialize a BigInt" popup
      // even though the refund itself succeeded server-side.
      return NextResponse.json({ ok: true, refund: stripBigInts(refund) });
    } catch (squareErr: any) {
      const detail = squareErr?.errors?.[0]?.detail
        ?? squareErr?.body?.errors?.[0]?.detail
        ?? (squareErr instanceof Error ? squareErr.message : "Refund failed");
      await supabase
        .from("order_refund_initiations")
        .update({ status: "failed", error: detail, updated_at: new Date().toISOString() })
        .eq("id", initiation.id);
      await logError(squareErr, {
        path: "/api/admin/orders/[id]/refund:square",
        source: "api-route",
        context: { orderId, paymentId, amountCents },
      });
      return NextResponse.json({ error: detail }, { status: 500 });
    }
  } catch (err) {
    await logError(err, { path: "/api/admin/orders/[id]/refund", source: "api-route" });
    return NextResponse.json({ error: "Refund failed" }, { status: 500 });
  }
}
