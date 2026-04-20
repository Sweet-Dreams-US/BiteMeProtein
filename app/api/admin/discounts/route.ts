import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { logError } from "@/lib/log-error";

/**
 * /api/admin/discounts — CRUD for promo codes.
 *   GET     — list all codes + usage counts
 *   POST    — create new code
 *   PATCH   — update existing (by id)
 *   DELETE  — ?id=<uuid> (cascade removes redemption rows)
 *
 * All admin-gated. Validation (check constraints, unique code) enforced
 * by the DB — we forward errors straight back to the client.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const supabase = getServiceClient();
    const [codesRes, redemptionsRes] = await Promise.all([
      supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("discount_redemptions").select("discount_code_id, amount_cents_saved"),
    ]);

    if (codesRes.error) {
      await logError(codesRes.error, { path: "/api/admin/discounts:GET", source: "api-route" });
      return NextResponse.json({ error: codesRes.error.message }, { status: 500 });
    }

    const usageByCode = new Map<string, { count: number; totalSaved: number }>();
    for (const r of (redemptionsRes.data ?? []) as Array<{ discount_code_id: string; amount_cents_saved: number }>) {
      const cur = usageByCode.get(r.discount_code_id) ?? { count: 0, totalSaved: 0 };
      cur.count++;
      cur.totalSaved += r.amount_cents_saved;
      usageByCode.set(r.discount_code_id, cur);
    }

    const rows = (codesRes.data ?? []).map((c: any) => ({
      ...c,
      usage_count: usageByCode.get(c.id)?.count ?? 0,
      total_saved_cents: usageByCode.get(c.id)?.totalSaved ?? 0,
    }));

    return NextResponse.json({ rows });
  } catch (err) {
    await logError(err, { path: "/api/admin/discounts:GET", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const EDITABLE_FIELDS = [
  "code",
  "name",
  "discount_type",
  "amount_cents",
  "percent",
  "fulfillment_restriction",
  "product_scope",
  "allowed_square_product_ids",
  "starts_at",
  "ends_at",
  "max_total_uses",
  "max_per_customer",
  "is_active",
  "notes",
];

function pick(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE_FIELDS) {
    if (k in body) out[k] = body[k];
  }
  return out;
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    if (!body.code || !body.name || !body.discount_type) {
      return NextResponse.json({ error: "code, name, and discount_type are required" }, { status: 400 });
    }
    const supabase = getServiceClient();
    const { data, error } = await supabase.from("discount_codes").insert(pick(body)).select().single();
    if (error) {
      await logError(error, { path: "/api/admin/discounts:POST", source: "api-route", context: { code: body.code } });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ row: data });
  } catch (err) {
    await logError(err, { path: "/api/admin/discounts:POST", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to create";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const id = body.id as string | undefined;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = getServiceClient();
    const patch = { ...pick(body), updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("discount_codes").update(patch).eq("id", id).select().single();
    if (error) {
      await logError(error, { path: "/api/admin/discounts:PATCH", source: "api-route", context: { id } });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ row: data });
  } catch (err) {
    await logError(err, { path: "/api/admin/discounts:PATCH", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to update";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = getServiceClient();
    const { error } = await supabase.from("discount_codes").delete().eq("id", id);
    if (error) {
      await logError(error, { path: "/api/admin/discounts:DELETE", source: "api-route", context: { id } });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    await logError(err, { path: "/api/admin/discounts:DELETE", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
