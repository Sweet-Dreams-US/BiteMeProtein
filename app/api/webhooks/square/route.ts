import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { logError } from "@/lib/log-error";
import { upsertOrder } from "@/lib/sync/orders";
import { upsertPayment } from "@/lib/sync/payments";
import { upsertRefund } from "@/lib/sync/refunds";
import { upsertCustomer } from "@/lib/sync/customers";
import { upsertCategory, upsertModifier, backfillCatalog } from "@/lib/sync/catalog";
import { upsertLoyaltyAccount, upsertLoyaltyEvent } from "@/lib/sync/loyalty";
import { upsertInventoryCount } from "@/lib/sync/inventory";
import { upsertLocation } from "@/lib/sync/locations";
import { upsertGiftCard, upsertDispute } from "@/lib/sync/tier-c";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/webhooks/square
 *
 * Square webhook receiver. Verifies the HMAC signature header against the
 * configured SQUARE_WEBHOOK_SIGNATURE_KEY, then dispatches to the matching
 * per-entity upsert handler.
 *
 * On signature mismatch → 401 (no side effects).
 * On unknown event type → 200 + warn log (avoids Square retry storm).
 * On handler error → 500 (Square will retry).
 *
 * Reference: https://developer.squareup.com/docs/webhooks/step3validate
 */

function verifySignature(req: NextRequest, body: string): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key) return false;

  const signature = req.headers.get("x-square-hmacsha256-signature");
  if (!signature) return false;

  // The URL Square used is whatever you registered in the dashboard.
  // In prod that's https://bitemeprotein.com/api/webhooks/square
  // but Vercel preview URLs differ. SQUARE_WEBHOOK_NOTIFICATION_URL lets
  // us pin the expected URL per environment.
  const url = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL ?? new URL(req.url).toString();

  const hmac = crypto.createHmac("sha256", key);
  hmac.update(url + body);
  const expected = hmac.digest("base64");

  // Constant-time compare
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  if (!verifySignature(req, bodyText)) {
    await logError("Invalid Square webhook signature", {
      path: "/api/webhooks/square",
      source: "webhook",
      level: "warn",
      context: { hasHeader: !!req.headers.get("x-square-hmacsha256-signature") },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(bodyText);
  } catch (err) {
    await logError(err, { path: "/api/webhooks/square", source: "webhook", context: { reason: "bad JSON" } });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type: string = event?.type ?? "unknown";
  const object = event?.data?.object ?? {};

  try {
    switch (type) {
      case "order.created":
      case "order.updated":
      case "order.fulfillment.updated":
        if (object.order_updated ?? object.order_created ?? object.order) {
          await upsertOrder(object.order_updated ?? object.order_created ?? object.order);
        }
        break;

      case "payment.created":
      case "payment.updated":
        if (object.payment) await upsertPayment(object.payment);
        break;

      case "refund.created":
      case "refund.updated":
        if (object.refund) await upsertRefund(object.refund);
        break;

      case "customer.created":
      case "customer.updated":
        if (object.customer) await upsertCustomer(object.customer);
        break;

      case "customer.deleted":
        // Future: soft-delete the row. For now we keep history.
        await logError(`customer.deleted received for ${object.customer?.id}`, {
          path: "/api/webhooks/square",
          source: "webhook",
          level: "info",
          context: { customerId: object.customer?.id },
        });
        break;

      case "catalog.version.updated":
        // Full catalog resync — Square doesn't send object-level diffs here.
        await backfillCatalog();
        break;

      case "inventory.count.updated":
        // Event may carry many counts in object.inventory_counts
        for (const count of object.inventory_counts ?? [object.inventory_count].filter(Boolean)) {
          await upsertInventoryCount(count);
        }
        break;

      case "loyalty.account.created":
      case "loyalty.account.updated":
        if (object.loyalty_account) await upsertLoyaltyAccount(object.loyalty_account);
        break;

      case "loyalty.event.created":
        if (object.loyalty_event) await upsertLoyaltyEvent(object.loyalty_event);
        break;

      case "location.created":
      case "location.updated":
        if (object.location) await upsertLocation(object.location);
        break;

      case "gift_card.created":
      case "gift_card.updated":
        if (object.gift_card) await upsertGiftCard(object.gift_card);
        break;

      case "dispute.created":
      case "dispute.evidence_added":
      case "dispute.state.updated":
        if (object.dispute) await upsertDispute(object.dispute);
        break;

      // Category and modifier events come through catalog.version.updated,
      // which triggers a full resync above. Explicit cases kept for clarity.
      case "catalog.category.upserted":
        if (object.category) await upsertCategory(object.category);
        break;
      case "catalog.modifier.upserted":
        if (object.modifier) await upsertModifier(object.modifier);
        break;

      default:
        await logError(`Unhandled Square webhook event type: ${type}`, {
          path: "/api/webhooks/square",
          source: "webhook",
          level: "info",
          context: { type, eventId: event?.event_id },
        });
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    await logError(err, {
      path: "/api/webhooks/square",
      source: "webhook",
      context: { type, eventId: event?.event_id },
    });
    // 500 tells Square to retry; that's desired for transient upsert failures.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
