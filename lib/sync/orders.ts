import { getAdminSupabase } from "./supabase-admin";
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

export async function upsertOrder(raw: any): Promise<void> {
  if (!raw?.id) return;

  const supabase = getAdminSupabase();

  const row = {
    id: raw.id,
    created_at: raw.createdAt ?? new Date().toISOString(),
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
    raw,
    synced_at: new Date().toISOString(),
  };

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
        raw: li,
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
