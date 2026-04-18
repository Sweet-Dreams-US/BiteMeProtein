/**
 * Notification helpers — email Haley when orders come in.
 *
 * Uses Resend (RESEND_API_KEY already in Vercel env). Keep this minimal:
 * a single plain-HTML email, fire-and-forget so a notification outage
 * never blocks order completion.
 */

interface OrderNotificationInput {
  orderId: string;
  paymentId?: string;
  totalCents: number;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  orderType: "pickup" | "shipping";
  shippingService?: string;
  shippingAddress?: {
    addressLine1: string;
    addressLine2?: string;
    locality: string;
    administrativeDistrictLevel1: string;
    postalCode: string;
  };
  bundles: Array<{
    tierName: string;
    priceCents: number;
    items: Array<{ name: string; quantity: number }>;
  }>;
  items: Array<{ name: string; quantity: number; priceCents?: number }>;
}

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function buildEmailHtml(data: OrderNotificationInput): string {
  const { orderId, totalCents, buyerName, buyerEmail, buyerPhone, orderType, shippingService, shippingAddress, bundles, items } = data;

  const addressBlock = shippingAddress
    ? `
      <p style="margin:4px 0;font-size:14px;color:#5a3e36;">
        <strong>Ship to:</strong><br>
        ${shippingAddress.addressLine1}${shippingAddress.addressLine2 ? `<br>${shippingAddress.addressLine2}` : ""}<br>
        ${shippingAddress.locality}, ${shippingAddress.administrativeDistrictLevel1} ${shippingAddress.postalCode}
      </p>
      ${shippingService ? `<p style="margin:4px 0;font-size:14px;color:#5a3e36;"><strong>Shipping:</strong> FedEx ${shippingService}</p>` : ""}
    `
    : `<p style="margin:4px 0;font-size:14px;color:#5a3e36;"><strong>Fulfillment:</strong> Customer pickup</p>`;

  const bundleRows = bundles
    .map(
      (b) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e6de;font-size:14px;color:#5a3e36;">
          <strong>${b.tierName}</strong>
          <div style="font-size:12px;color:#b0a098;margin-top:2px;">
            ${b.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
          </div>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e6de;text-align:right;font-size:14px;color:#5a3e36;">
          ${formatPrice(b.priceCents)}
        </td>
      </tr>
    `
    )
    .join("");

  const itemRows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e6de;font-size:14px;color:#5a3e36;">
          ${i.name} ×${i.quantity}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e6de;text-align:right;font-size:14px;color:#5a3e36;">
          ${i.priceCents ? formatPrice(i.priceCents * i.quantity) : "—"}
        </td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Order — Bite Me Protein</title>
</head>
<body style="margin:0;padding:0;background:#FFF9F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF9F0;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(132,52,48,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:#843430;padding:28px;text-align:center;">
              <h1 style="margin:0;font-size:28px;color:white;font-family:Georgia,serif;">🎉 New Order!</h1>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">
                Order ${orderId.slice(0, 8).toUpperCase()} · ${formatPrice(totalCents)}
              </p>
            </td>
          </tr>

          <!-- Customer Info -->
          <tr>
            <td style="padding:24px;">
              <h2 style="margin:0 0 12px;font-size:18px;color:#843430;">Customer</h2>
              <p style="margin:4px 0;font-size:14px;color:#5a3e36;">
                <strong>${buyerName || "—"}</strong>
              </p>
              ${buyerEmail ? `<p style="margin:4px 0;font-size:14px;color:#5a3e36;">📧 <a href="mailto:${buyerEmail}" style="color:#843430;">${buyerEmail}</a></p>` : ""}
              ${buyerPhone ? `<p style="margin:4px 0;font-size:14px;color:#5a3e36;">📞 <a href="tel:${buyerPhone}" style="color:#843430;">${buyerPhone}</a></p>` : ""}

              <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f0e6de;">
                <h2 style="margin:0 0 8px;font-size:18px;color:#843430;">
                  ${orderType === "shipping" ? "📦 Shipping Order" : "🏪 Pickup Order"}
                </h2>
                ${addressBlock}
              </div>
            </td>
          </tr>

          <!-- Order Items -->
          <tr>
            <td style="padding:0 24px 24px;">
              <h2 style="margin:0 0 12px;font-size:18px;color:#843430;">Order</h2>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #f0e6de;border-radius:8px;overflow:hidden;">
                ${bundleRows}
                ${itemRows}
                <tr>
                  <td style="padding:12px;background:#FFF5EE;font-size:14px;font-weight:bold;color:#843430;">Total</td>
                  <td style="padding:12px;background:#FFF5EE;text-align:right;font-size:16px;font-weight:bold;color:#843430;">
                    ${formatPrice(totalCents)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 24px 24px;text-align:center;">
              <a href="https://squareup.com/dashboard/orders/overview" style="display:inline-block;padding:12px 24px;background:#843430;color:white;text-decoration:none;border-radius:100px;font-weight:bold;font-size:14px;">
                View in Square Dashboard
              </a>
              <a href="https://bitemeprotein.com/admin/orders" style="display:inline-block;margin-left:8px;padding:12px 24px;background:white;color:#843430;text-decoration:none;border-radius:100px;font-weight:bold;font-size:14px;border:2px solid #843430;">
                View in Admin
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;background:#FFF5EE;text-align:center;font-size:12px;color:#b0a098;">
              You received this because you're the admin at Bite Me Protein Bakery.
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

/**
 * Send a new order notification to the admin (Haley).
 * Fire-and-forget: errors are logged but don't propagate so a
 * notification failure can't break order completion.
 */
export async function notifyAdminOfOrder(data: OrderNotificationInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || "haley@bitemeprotein.com";
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "orders@bitemeprotein.com";

  if (!apiKey) {
    console.warn("[notifications] RESEND_API_KEY missing, skipping admin email");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Bite Me Orders <${fromEmail}>`,
        to: [adminEmail],
        subject: `🎉 New Order · ${data.buyerName || "Customer"} · ${formatPrice(data.totalCents)}`,
        html: buildEmailHtml(data),
        ...(data.buyerEmail ? { reply_to: data.buyerEmail } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[notifications] Resend failed:", res.status, errText);
    }
  } catch (err) {
    console.error("[notifications] Resend threw:", err);
  }
}
