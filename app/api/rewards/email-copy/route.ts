import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/log-error";

/**
 * POST /api/rewards/email-copy
 *
 * Public endpoint — customer clicks "Email me this" on /rewards.
 * Sends a branded email via Resend with their points + reward tiers
 * + any featured deals. Reply-to = admin inbox so questions land with Haley.
 *
 * Body: {
 *   email: string,
 *   points: number,
 *   lifetimePoints: number,
 *   terminology?: { one?: string; other?: string },
 *   rewardTiers?: Array<{ id: string; name: string; points: number }>,
 *   featuredDeals?: Array<{ title?: string; description?: string } | string>,
 * }
 *
 * Returns { sent: true } on success, { sent: false, reason } on validation
 * or configuration failure. Fire-and-forget-ish — never throws.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Body {
  email?: string;
  points?: number;
  lifetimePoints?: number;
  terminology?: { one?: string; other?: string };
  rewardTiers?: Array<{ id: string; name: string; points: number }>;
  featuredDeals?: Array<{ title?: string; description?: string } | string>;
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function buildHtml(data: Required<Pick<Body, "points" | "lifetimePoints">> & {
  terminology?: Body["terminology"];
  rewardTiers?: Body["rewardTiers"];
  featuredDeals?: Body["featuredDeals"];
}): string {
  const pointsWord =
    data.points === 1
      ? data.terminology?.one ?? "Point"
      : data.terminology?.other ?? "Points";

  const tiersHtml = (data.rewardTiers ?? [])
    .map((t) => {
      const unlocked = data.points >= t.points;
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0e6de;font-size:14px;color:#5a3e36;">${t.name}</td><td style="padding:8px 12px;border-bottom:1px solid #f0e6de;text-align:right;font-size:14px;color:${unlocked ? "#2f8a3e" : "#b0a098"};">${t.points} ${pointsWord.toLowerCase()}${unlocked ? " <strong>— unlocked</strong>" : ""}</td></tr>`;
    })
    .join("");

  const dealsHtml = (data.featuredDeals ?? [])
    .map((d) => {
      const obj = typeof d === "string" ? { title: d } : d;
      if (!obj) return "";
      return `<li style="margin-bottom:8px;color:#5a3e36;"><strong>${obj.title ?? ""}</strong>${obj.description ? ` — ${obj.description}` : ""}</li>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Bite Me rewards</title></head>
<body style="margin:0;padding:0;background:#FFF9F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(132,52,48,0.06);">
        <tr><td style="background:#843430;padding:28px;text-align:center;">
          <h1 style="margin:0;font-size:28px;color:white;font-family:Georgia,serif;">⭐ Your rewards</h1>
          <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">
            <strong>${data.points}</strong> ${pointsWord.toLowerCase()} · Lifetime <strong>${data.lifetimePoints}</strong>
          </p>
        </td></tr>
        ${tiersHtml
          ? `<tr><td style="padding:20px 24px 8px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:0.05em;text-transform:uppercase;color:#b0a098;">Reward tiers</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #f0e6de;border-radius:8px;overflow:hidden;">${tiersHtml}</table>
            </td></tr>`
          : ""}
        ${dealsHtml
          ? `<tr><td style="padding:16px 24px 8px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:0.05em;text-transform:uppercase;color:#b0a098;">Current deals</p>
              <ul style="margin:0;padding-left:20px;font-size:14px;">${dealsHtml}</ul>
            </td></tr>`
          : ""}
        <tr><td style="padding:16px 24px 24px;text-align:center;">
          <a href="https://bitemeprotein.com/shop" style="display:inline-block;padding:14px 28px;background:#843430;color:white;text-decoration:none;border-radius:100px;font-weight:bold;font-size:14px;">Shop now</a>
        </td></tr>
        <tr><td style="padding:20px 24px;background:#FFF5EE;text-align:center;font-size:12px;color:#b0a098;">
          Questions? Reply to this email.<br>
          Bite Me Protein Bakery · bitemeprotein.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!email || !isEmail(email)) {
      return NextResponse.json({ sent: false, reason: "Valid email required" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "orders@bitemeprotein.com";
    const replyTo = process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || "haley@bitemeprotein.com";

    if (!apiKey) {
      await logError("RESEND_API_KEY missing, can't send rewards copy", {
        path: "/api/rewards/email-copy",
        source: "api-route",
        level: "warn",
      });
      return NextResponse.json(
        { sent: false, reason: "Email sending isn't configured. Try again later." },
        { status: 503 },
      );
    }

    const points = Number.isFinite(body.points) ? (body.points as number) : 0;
    const lifetimePoints = Number.isFinite(body.lifetimePoints) ? (body.lifetimePoints as number) : 0;

    const html = buildHtml({
      points,
      lifetimePoints,
      terminology: body.terminology,
      rewardTiers: body.rewardTiers,
      featuredDeals: body.featuredDeals,
    });

    const pointsWord =
      points === 1 ? body.terminology?.one ?? "point" : body.terminology?.other ?? "points";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Bite Me <${fromEmail}>`,
        to: [email],
        subject: `⭐ Your Bite Me rewards — ${points} ${pointsWord.toLowerCase()}`,
        html,
        reply_to: replyTo,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      await logError(`Resend ${res.status}: ${errText}`, {
        path: "/api/rewards/email-copy",
        source: "api-route",
        context: { email, status: res.status },
      });
      return NextResponse.json({ sent: false, reason: "Couldn't send email. Try again." }, { status: 502 });
    }

    return NextResponse.json({ sent: true });
  } catch (err) {
    await logError(err, { path: "/api/rewards/email-copy", source: "api-route" });
    return NextResponse.json({ sent: false, reason: "Send failed" }, { status: 500 });
  }
}
