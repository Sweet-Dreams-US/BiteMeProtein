import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log-error";

/**
 * GET /api/account/orders
 *
 * Returns the currently-signed-in customer's order history. Requires a
 * Supabase Auth session (JWT either in Authorization header or
 * sb-access-token cookie).
 *
 * Match strategy — combines three signals so old POS orders surface
 * even when the customer row wasn't linked:
 *   1. customer_profiles.square_customer_id → square_orders.customer_id
 *   2. square_orders.raw.fulfillments[0].shipmentDetails.recipient.emailAddress = user.email
 *   3. square_orders.raw.fulfillments[0].pickupDetails.recipient.emailAddress = user.email
 * Dedupe by id, sort created_at desc.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function getAnonClient(authHeader: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    },
  );
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: NextRequest) {
  try {
    // Resolve the current user from the JWT.
    const authHeader =
      req.headers.get("authorization") ||
      (req.cookies.get("sb-access-token")?.value
        ? `Bearer ${req.cookies.get("sb-access-token")?.value}`
        : "");

    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const anon = getAnonClient(authHeader);
    const { data: userData, error: userErr } = await anon.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const user = userData.user;

    const admin = getServiceClient();

    // 1. Pull the profile to get square_customer_id
    const { data: profile } = await admin
      .from("customer_profiles")
      .select("square_customer_id, email")
      .eq("user_id", user.id)
      .maybeSingle();

    const squareCustomerId = (profile as { square_customer_id?: string } | null)?.square_customer_id ?? null;
    const emailLc = (user.email ?? "").toLowerCase();

    // 2. Query orders two ways, merge
    const baseSelect = `
      id, created_at, state, total_money_cents, source_name, customer_id, raw,
      line_items:square_order_line_items(id, name, quantity, base_price_cents)
    `;

    // Supabase query builders are PromiseLike but not Promise — use an
    // unknown-typed array and let Promise.all handle the thenable calls.
    const queries: PromiseLike<{ data: any[] | null; error: any }>[] = [];

    if (squareCustomerId) {
      queries.push(
        admin.from("square_orders").select(baseSelect).eq("customer_id", squareCustomerId)
          .order("created_at", { ascending: false })
          .limit(50) as unknown as PromiseLike<{ data: any[] | null; error: any }>,
      );
    }

    if (emailLc) {
      queries.push(
        admin
          .from("square_orders")
          .select(baseSelect)
          .or(
            `raw->fulfillments->0->shipmentDetails->recipient->>emailAddress.ilike.${emailLc},raw->fulfillments->0->pickupDetails->recipient->>emailAddress.ilike.${emailLc}`,
          )
          .order("created_at", { ascending: false })
          .limit(50) as unknown as PromiseLike<{ data: any[] | null; error: any }>,
      );
    }

    const results = await Promise.all(queries);
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) {
      await logError(firstErr, { path: "/api/account/orders", source: "api-route", context: { userId: user.id } });
      return NextResponse.json({ error: firstErr.message }, { status: 500 });
    }

    const seen = new Set<string>();
    const orders: any[] = [];
    for (const r of results) {
      for (const row of r.data ?? []) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        orders.push(row);
      }
    }
    orders.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    // 3. Pull fulfillment overlay for these orders
    const fulfillmentsById: Record<string, any> = {};
    if (orders.length > 0) {
      const ids = orders.map((o) => o.id);
      const { data: fRows } = await admin
        .from("order_fulfillment")
        .select("square_order_id, status, tracking_number, carrier, shipped_at")
        .in("square_order_id", ids);
      for (const f of (fRows ?? []) as Array<{ square_order_id: string }>) {
        fulfillmentsById[f.square_order_id] = f;
      }
    }

    const shaped = orders.map((o) => ({
      id: o.id,
      shortId: o.id.slice(-6).toUpperCase(),
      createdAt: o.created_at,
      state: o.state,
      totalCents: Number(o.total_money_cents ?? 0),
      source: o.source_name,
      items: (o.line_items ?? []).map((li: any) => ({
        name: li.name,
        quantity: li.quantity,
        priceCents: li.base_price_cents,
      })),
      fulfillment: fulfillmentsById[o.id] ?? null,
    }));

    return NextResponse.json({ orders: shaped });
  } catch (err) {
    await logError(err, { path: "/api/account/orders", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to load orders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
