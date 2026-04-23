import { getAdminSupabase } from "./supabase-admin";
import { stripBigInts } from "./json-safe";
import { getSquareClient, paginate, withRetry } from "./square-client";
import { logError } from "@/lib/log-error";
import type { SyncResult } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Sync handler for Square orders + nested line items.
 * Each upsert writes the order row and replaces its line items atomically.
 */

function toCents(money: { amount?: number | string | bigint } | undefined): number | null {
  if (!money?.amount) return null;
  try {
    return Number(money.amount);
  } catch {
    return null;
  }
}

/**
 * Find the event (if any) whose date range contains the given timestamp.
 * Returns null if no match. Matching rule:
 *   event.date <= orderCreatedAt <= (event.end_date OR event.date + 1 day)
 * so single-day events without end_date still match sales made during
 * their active day.
 */
async function findEventForOrder(
  supabase: ReturnType<typeof getAdminSupabase>,
  orderCreatedAt: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("events")
    .select("id, date, end_date")
    .lte("date", orderCreatedAt)
    .order("date", { ascending: false })
    .limit(5);
  if (!Array.isArray(data) || data.length === 0) return null;
  const orderMs = new Date(orderCreatedAt).getTime();
  for (const ev of data as Array<{ id: string; date: string; end_date: string | null }>) {
    const end = ev.end_date
      ? new Date(ev.end_date).getTime()
      : new Date(ev.date).getTime() + 24 * 60 * 60 * 1000;
    if (orderMs <= end) return ev.id;
  }
  return null;
}

export async function upsertOrder(raw: any): Promise<void> {
  if (!raw?.id) return;

  const supabase = getAdminSupabase();

  const createdAt = raw.createdAt ?? new Date().toISOString();
  const isInPerson = !raw.source?.name
    || raw.source.name === "Square Point of Sale"
    || raw.source.name === "Point of Sale";

  // Preserve any manually-assigned event_id across resyncs. If the row
  // already has one set, we keep it. If unset and the order is in-person,
  // try to auto-match by date (online orders never auto-tag — they
  // originate from the website, not a tent event).
  const { data: existing } = await supabase
    .from("square_orders")
    .select("event_id")
    .eq("id", raw.id)
    .maybeSingle();

  let eventId: string | null | undefined = undefined; // undefined = don't write
  if (existing?.event_id) {
    eventId = existing.event_id;
  } else if (isInPerson) {
    eventId = await findEventForOrder(supabase, createdAt);
  }

  const row: Record<string, unknown> = {
    id: raw.id,
    created_at: createdAt,
    updated_at: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
    state: raw.state ?? null,
    location_id: raw.locationId ?? null,
    customer_id: raw.customerId ?? null,
    total_money_cents: toCents(raw.totalMoney),
    total_tax_cents: toCents(raw.totalTaxMoney),
    total_tip_cents: toCents(raw.totalTipMoney),
    total_discount_cents: toCents(raw.totalDiscountMoney),
    source_name: raw.source?.name ?? null,
    reference_id: raw.referenceId ?? null,
    version: raw.version ?? null,
    raw: stripBigInts(raw),
    synced_at: new Date().toISOString(),
  };
  if (eventId !== undefined) row.event_id = eventId;

  const { error } = await supabase.from("square_orders").upsert(row, { onConflict: "id" });
  if (error) {
    await logError(error, {
      path: "lib/sync/orders.ts:upsertOrder",
      source: "lib",
      context: { orderId: raw.id },
    });
    return;
  }

  // Replace line items: delete existing, insert new.
  // Cascade delete handled by FK on square_order_line_items.
  const lineItems: any[] = raw.lineItems ?? [];
  if (lineItems.length > 0) {
    await supabase.from("square_order_line_items").delete().eq("order_id", raw.id);
    const rows = lineItems
      .filter((li: any) => li.uid)
      .map((li: any) => ({
        id: li.uid,
        order_id: raw.id,
        name: li.name ?? null,
        quantity: li.quantity ?? null,
        base_price_cents: toCents(li.basePriceMoney),
        variation_name: li.variationName ?? null,
        catalog_object_id: li.catalogObjectId ?? null,
        note: li.note ?? null,
        raw: stripBigInts(li),
      }));
    if (rows.length > 0) {
      const { error: liErr } = await supabase.from("square_order_line_items").upsert(rows, { onConflict: "id" });
      if (liErr) {
        await logError(liErr, {
          path: "lib/sync/orders.ts:upsertOrder:lineItems",
          source: "lib",
          context: { orderId: raw.id },
        });
      }
    }
  }
}

async function* iterateOrders(since?: Date): AsyncGenerator<any> {
  const client = getSquareClient();
  const locationId = process.env.SQUARE_LOCATION_ID!;
  const startAt = since?.toISOString();

  yield* paginate(
    (req) => withRetry(() => (client.orders as any).search(req), "orders.search"),
    (resp: any) => resp.orders,
    {
      locationIds: [locationId],
      query: {
        sort: { sortField: "CREATED_AT", sortOrder: "DESC" },
        ...(startAt ? { filter: { dateTimeFilter: { createdAt: { startAt } } } } : {}),
      },
      limit: 500,
    },
  );
}

export async function backfillOrders(since?: Date): Promise<SyncResult> {
  const started = Date.now();
  let count = 0;
  let errors = 0;

  for await (const order of iterateOrders(since)) {
    try {
      await upsertOrder(order);
      count++;
    } catch (err) {
      errors++;
      await logError(err, { path: "lib/sync/orders.ts:backfillOrders", source: "lib" });
    }
  }

  return { entity: "orders", count, durationMs: Date.now() - started, errors };
}

export async function syncRecentOrders(hoursBack: number): Promise<SyncResult> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  return backfillOrders(since);
}
