import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log-error";

/**
 * POST /api/special-order
 *
 * Replaces the prior mailto: flow on /order. Persists the request to
 * special_orders table FIRST (so we never lose a request, even if the
 * Resend send fails), then fires a branded admin notification email
 * fire-and-forget.
 *
 * Two failure modes are intentionally different:
 *   - Persist fails  → return 500. Customer sees an error, can retry.
 *   - Email fails    → still return 200. Row is in the DB; admin can
 *                      see it in /admin/special-orders. We log the
 *                      email failure for follow-up.
 *
 * Public endpoint, no auth required.
 */

interface SpecialOrderBody {
  name: string;
  phone: string;
  email: string;
  orderType: "standard" | "bear" | "cake" | "event" | "catering-small" | "catering-medium" | "catering-large";
  details?: Record<string, unknown>;
  dateNeeded?: string;
  fulfillment?: "pickup" | "delivery";
  notes?: string;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function adminEmailHtml(body: SpecialOrderBody, requestId: string): string {
  const escape = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
  const typeLabels: Record<SpecialOrderBody["orderType"], string> = {
    standard: "Standard Items",
    bear: "Bear Size Treats",
    cake: "Birthday Cake",
    event: "Event / Bulk Order",
    "catering-small": "Catering — Small",
    "catering-medium": "Catering — Medium",
    "catering-large": "Catering — Large",
  };
  const detailLines = Object.entries(body.details ?? {})
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#7a6a62;font-size:12px;">${escape(k)}</td><td style="padding:6px 12px;color:#5a3e36;font-size:13px;">${escape(typeof v === "string" ? v : JSON.stringify(v))}</td></tr>`)
    .join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FFF9F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF9F0;padding:24px 0;"><tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(132,52,48,0.06);">
        <tr><td style="background:#843430;padding:24px;text-align:center;">
          <h1 style="margin:0;font-size:22px;color:white;font-family:Georgia,serif;">🎂 New Special Order Request</h1>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">${escape(typeLabels[body.orderType] ?? body.orderType)}</p>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 16px;font-size:14px;color:#5a3e36;"><strong>${escape(body.name)}</strong> just submitted a request. 24-hour response window starts now.</p>
          <table width="100%" style="border:1px solid #f0e6de;border-radius:8px;border-collapse:separate;border-spacing:0;">
            <tr><td style="padding:6px 12px;color:#7a6a62;font-size:12px;width:30%;">Name</td><td style="padding:6px 12px;color:#5a3e36;font-size:13px;">${escape(body.name)}</td></tr>
            <tr><td style="padding:6px 12px;color:#7a6a62;font-size:12px;">Phone</td><td style="padding:6px 12px;color:#5a3e36;font-size:13px;"><a href="tel:${escape(body.phone)}" style="color:#843430;">${escape(body.phone)}</a></td></tr>
            <tr><td style="padding:6px 12px;color:#7a6a62;font-size:12px;">Email</td><td style="padding:6px 12px;color:#5a3e36;font-size:13px;"><a href="mailto:${escape(body.email)}" style="color:#843430;">${escape(body.email)}</a></td></tr>
            ${body.dateNeeded ? `<tr><td style="padding:6px 12px;color:#7a6a62;font-size:12px;">Date Needed</td><td style="padding:6px 12px;color:#5a3e36;font-size:13px;">${escape(body.dateNeeded)}</td></tr>` : ""}
            ${body.fulfillment ? `<tr><td style="padding:6px 12px;color:#7a6a62;font-size:12px;">Fulfillment</td><td style="padding:6px 12px;color:#5a3e36;font-size:13px;text-transform:capitalize;">${escape(body.fulfillment)}</td></tr>` : ""}
            ${detailLines}
            ${body.notes ? `<tr><td style="padding:6px 12px;color:#7a6a62;font-size:12px;">Notes</td><td style="padding:6px 12px;color:#5a3e36;font-size:13px;white-space:pre-wrap;">${escape(body.notes)}</td></tr>` : ""}
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#b0a098;">Request ID: ${requestId}</p>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SpecialOrderBody;

    // Light validation — bail early on garbage so we don't pollute the table.
    if (!body.name?.trim() || !body.phone?.trim() || !body.email?.trim() || !body.orderType) {
      return NextResponse.json({ error: "Name, phone, email, and order type are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: inserted, error: insertErr } = await supabase
      .from("special_orders")
      .insert({
        name: body.name.trim(),
        phone: body.phone.trim(),
        email: body.email.trim().toLowerCase(),
        order_type: body.orderType,
        details: body.details ?? {},
        date_needed: body.dateNeeded || null,
        fulfillment: body.fulfillment || null,
        notes: body.notes || null,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      await logError(insertErr ?? new Error("special_orders insert returned null"), {
        path: "/api/special-order:POST",
        source: "api-route",
        context: { name: body.name, orderType: body.orderType },
      });
      return NextResponse.json({ error: "Couldn't save your request. Please try again or call us." }, { status: 500 });
    }

    // Email is best-effort. The request is already persisted, so a Resend
    // outage doesn't lose customer intent. Fire-and-forget pattern matches
    // lib/notifications.ts for the order-confirmation flow.
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || "haley@bitemeprotein.com";
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "orders@bitemeprotein.com";
    if (apiKey) {
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `Bite Me <${fromEmail}>`,
          to: [adminEmail],
          reply_to: body.email,
          subject: `🎂 Special order: ${body.name} — ${body.orderType}`,
          html: adminEmailHtml(body, inserted.id),
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          await logError(`Resend ${res.status}: ${text}`, {
            path: "/api/special-order:resend",
            source: "api-route",
            context: { requestId: inserted.id, status: res.status },
          });
        }
      }).catch(async (err) => {
        await logError(err, { path: "/api/special-order:resend", source: "api-route", context: { requestId: inserted.id } });
      });
    } else {
      await logError("RESEND_API_KEY missing, special order email skipped", {
        path: "/api/special-order:POST",
        source: "api-route",
        level: "warn",
        context: { requestId: inserted.id },
      });
    }

    return NextResponse.json({ success: true, requestId: inserted.id });
  } catch (err) {
    await logError(err, { path: "/api/special-order:POST", source: "api-route" });
    return NextResponse.json({ error: "Couldn't submit your request. Please try again." }, { status: 500 });
  }
}
