/**
 * Customer-facing transactional emails.
 *
 * Four templates — confirmation, preparing, shipped, delivered — all sent
 * via Resend (same provider as admin alerts). Each send is fire-and-forget:
 * errors log to /admin/errors but never propagate so a transient Resend
 * outage can't break a checkout or fulfillment save.
 *
 * Visual DNA matches lib/notifications.ts so customer and admin emails
 * look like they came from the same brand.
 */

import { logError } from "@/lib/log-error";

export type CustomerEmailType = "confirmation" | "preparing" | "shipped" | "delivered";

export interface OrderEmailItem {
  name: string;
  quantity: number | string;
  priceCents?: number;
}

export interface OrderEmailData {
  orderId: string;
  shortId: string;
  buyerEmail: string;
  buyerName?: string;
  totalCents: number;
  orderType: "pickup" | "shipping";
  items: OrderEmailItem[];
  trackUrl: string;
  /** Only used by shipped template */
  carrier?: string;
  /** Only used by shipped template */
  trackingNumber?: string;
  /** Only used by shipped template — built from carrier deep-link */
  trackingUrl?: string;
}

const formatPrice = (cents: number | undefined) =>
  cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;

// ── Shared skeleton ─────────────────────────────────────────────────────────

interface LayoutOptions {
  headerEmoji: string;
  headerTitle: string;
  greeting: string;
  body: string;
  data: OrderEmailData;
  cta: { label: string; url: string };
}

function buildEmail(opts: LayoutOptions): string {
  const { headerEmoji, headerTitle, greeting, body, data, cta } = opts;

  const itemRows = data.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e6de;font-size:14px;color:#5a3e36;">
          ${i.name} <span style="color:#b0a098;">×${i.quantity}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e6de;text-align:right;font-size:14px;color:#5a3e36;">
          ${i.priceCents != null ? formatPrice(i.priceCents) : ""}
        </td>
      </tr>
    `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${headerTitle}</title>
</head>
<body style="margin:0;padding:0;background:#FFF9F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF9F0;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(132,52,48,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:#843430;padding:28px;text-align:center;">
              <h1 style="margin:0;font-size:28px;color:white;font-family:Georgia,serif;">${headerEmoji} ${headerTitle}</h1>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">
                Order #${data.shortId} · ${formatPrice(data.totalCents)}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 24px 8px;">
              <p style="margin:0 0 12px;font-size:16px;color:#5a3e36;">${greeting}</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#5a3e36;">${body}</p>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding:16px 24px 8px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:0.05em;text-transform:uppercase;color:#b0a098;">Order summary</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #f0e6de;border-radius:8px;overflow:hidden;">
                ${itemRows}
                <tr>
                  <td style="padding:12px;background:#FFF5EE;font-size:14px;font-weight:bold;color:#843430;">Total</td>
                  <td style="padding:12px;background:#FFF5EE;text-align:right;font-size:16px;font-weight:bold;color:#843430;">
                    ${formatPrice(data.totalCents)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:16px 24px 24px;text-align:center;">
              <a href="${cta.url}" style="display:inline-block;padding:14px 28px;background:#843430;color:white;text-decoration:none;border-radius:100px;font-weight:bold;font-size:14px;">
                ${cta.label}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;background:#FFF5EE;text-align:center;font-size:12px;color:#b0a098;">
              Questions? Just reply to this email — it goes straight to Haley.<br>
              Bite Me Protein Bakery · bitemeprotein.com
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ── Resend send wrapper ─────────────────────────────────────────────────────

interface SendInput {
  to: string;
  subject: string;
  html: string;
  context: { orderId: string; type: CustomerEmailType };
}

async function sendViaResend(input: SendInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "orders@bitemeprotein.com";
  const replyTo = process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || "haley@bitemeprotein.com";

  if (!apiKey) {
    await logError("RESEND_API_KEY missing, skipping customer email", {
      path: `lib/customer-emails.ts:${input.context.type}`,
      source: "lib",
      level: "warn",
      context: input.context,
    });
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Bite Me <${fromEmail}>`,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        reply_to: replyTo,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      await logError(`Resend ${res.status}: ${errText}`, {
        path: `lib/customer-emails.ts:${input.context.type}`,
        source: "lib",
        context: { ...input.context, status: res.status },
      });
    }
  } catch (err) {
    await logError(err, {
      path: `lib/customer-emails.ts:${input.context.type}`,
      source: "lib",
      context: input.context,
    });
  }
}

// ── Template functions ──────────────────────────────────────────────────────

function greeting(data: OrderEmailData): string {
  return data.buyerName ? `Hi ${data.buyerName.split(" ")[0]},` : "Hi there,";
}

export async function sendOrderConfirmation(data: OrderEmailData): Promise<void> {
  if (!data.buyerEmail) return;

  const body =
    data.orderType === "pickup"
      ? "Thank you for ordering from Bite Me! We'll get your treats baked fresh. Your pickup details are on the order page — please come by within 1–2 days so they're at their best."
      : "Thank you for ordering from Bite Me! We bake each treat fresh, then pack with a cold pack and ship via FedEx. You'll get another email with tracking the moment your order heads out — usually 1–2 business days.";

  const html = buildEmail({
    headerEmoji: "🎉",
    headerTitle: "Order confirmed!",
    greeting: greeting(data),
    body,
    data,
    cta: { label: "Track your order", url: data.trackUrl },
  });

  await sendViaResend({
    to: data.buyerEmail,
    subject: `🎉 Your Bite Me order is confirmed — #${data.shortId}`,
    html,
    context: { orderId: data.orderId, type: "confirmation" },
  });
}

export async function sendOrderPreparing(data: OrderEmailData): Promise<void> {
  if (!data.buyerEmail) return;

  const body = `Just a quick heads up — we're in the kitchen baking your order right now. Each treat is made fresh, so this step takes a little love. We'll send another email the moment your order is ${data.orderType === "pickup" ? "ready for pickup" : "out the door"}.`;

  const html = buildEmail({
    headerEmoji: "🧁",
    headerTitle: "We're baking your order",
    greeting: greeting(data),
    body,
    data,
    cta: { label: "Check order status", url: data.trackUrl },
  });

  await sendViaResend({
    to: data.buyerEmail,
    subject: `🧁 We're baking your order — #${data.shortId}`,
    html,
    context: { orderId: data.orderId, type: "preparing" },
  });
}

export async function sendOrderShipped(data: OrderEmailData): Promise<void> {
  if (!data.buyerEmail) return;

  const trackingBlock = data.trackingNumber
    ? `Your ${data.carrier ?? "carrier"} tracking number is <strong>${data.trackingNumber}</strong>.${
        data.trackingUrl
          ? ` <a href="${data.trackingUrl}" style="color:#843430;">Track with ${data.carrier ?? "carrier"}</a>.`
          : ""
      }`
    : "Your order has left our kitchen.";

  const body = `${trackingBlock} We packed with a cold pack — keep an eye out and refrigerate once it arrives.`;

  const html = buildEmail({
    headerEmoji: "📦",
    headerTitle: "Your order is on the way",
    greeting: greeting(data),
    body,
    data,
    cta: {
      label: data.trackingUrl ? `Track with ${data.carrier ?? "carrier"}` : "View order",
      url: data.trackingUrl ?? data.trackUrl,
    },
  });

  await sendViaResend({
    to: data.buyerEmail,
    subject: `📦 Your Bite Me order is on the way — #${data.shortId}`,
    html,
    context: { orderId: data.orderId, type: "shipped" },
  });
}

export async function sendOrderDelivered(data: OrderEmailData): Promise<void> {
  if (!data.buyerEmail) return;

  const body = `Your order arrived! Hope you love every bite. If you have a second, we'd be so grateful if you'd share a photo or tag us on Instagram @bitemeprotein — it genuinely makes Haley's day.`;

  const html = buildEmail({
    headerEmoji: "✨",
    headerTitle: "Your order arrived — enjoy!",
    greeting: greeting(data),
    body,
    data,
    cta: { label: "Order again", url: "https://bitemeprotein.com/shop" },
  });

  await sendViaResend({
    to: data.buyerEmail,
    subject: `✨ Your Bite Me order arrived — enjoy! — #${data.shortId}`,
    html,
    context: { orderId: data.orderId, type: "delivered" },
  });
}

// ── Dispatcher for API route ────────────────────────────────────────────────

export async function sendCustomerEmail(type: CustomerEmailType, data: OrderEmailData): Promise<void> {
  switch (type) {
    case "confirmation": return sendOrderConfirmation(data);
    case "preparing": return sendOrderPreparing(data);
    case "shipped": return sendOrderShipped(data);
    case "delivered": return sendOrderDelivered(data);
  }
}

// ── Carrier tracking URL helper ─────────────────────────────────────────────

/**
 * Returns a deep-link into the carrier's tracking page for a given carrier
 * string (as stored in order_fulfillment.carrier) + tracking number.
 * Unknown carriers return null so the email falls back to the /track URL.
 */
export function carrierTrackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  if (!carrier || !trackingNumber) return null;
  const t = encodeURIComponent(trackingNumber);
  const c = carrier.toUpperCase();
  if (c === "FEDEX") return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  if (c === "UPS") return `https://www.ups.com/track?tracknum=${t}`;
  if (c === "USPS") return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${t}`;
  if (c === "DHL") return `https://www.dhl.com/en/express/tracking.html?AWB=${t}`;
  return null;
}
