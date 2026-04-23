import { getAdminSupabase } from "./supabase-admin";
import { stripBigInts } from "./json-safe";
import { getSquareClient } from "./square-client";
import { logError } from "@/lib/log-error";
import type { SyncResult } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function upsertInventoryCount(raw: any): Promise<void> {
  if (!raw?.catalogObjectId || !raw?.locationId || !raw?.state) return;
  const supabase = getAdminSupabase();

  const row = {
    variation_id: raw.catalogObjectId,
    location_id: raw.locationId,
    state: raw.state,
    quantity: raw.quantity ?? "0",
    calculated_at: raw.calculatedAt ?? new Date().toISOString(),
    raw: stripBigInts(raw),
    synced_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("square_inventory_counts")
    .upsert(row, { onConflict: "variation_id,location_id,state" });
  if (error) {
    await logError(error, {
      path: "lib/sync/inventory.ts:upsertInventoryCount",
      source: "lib",
      context: { variationId: raw.catalogObjectId, locationId: raw.locationId },
    });
  }
}

export async function backfillInventory(): Promise<SyncResult> {
  const started = Date.now();
  let count = 0;
  let errors = 0;

  const client = getSquareClient();
  const supabase = getAdminSupabase();

  // Pull all variations we know about, then query counts in batches of 100.
  const { data: variations, error: listErr } = await supabase
    .from("square_product_variations")
    .select("id")
    .eq("track_inventory", true);

  if (listErr) {
    await logError(listErr, { path: "lib/sync/inventory.ts:list", source: "lib" });
    return { entity: "inventory", count: 0, durationMs: Date.now() - started, errors: 1 };
  }

  const locationId = process.env.SQUARE_LOCATION_ID!;
  const ids = (variations ?? []).map((v) => v.id);

  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    try {
      const iterable = (client.inventory as any).batchGetCounts({
        catalogObjectIds: batch,
        locationIds: [locationId],
      });
      for await (const countObj of iterable) {
        await upsertInventoryCount(countObj);
        count++;
      }
    } catch (err) {
      errors++;
      await logError(err, {
        path: "lib/sync/inventory.ts:backfillInventory",
        source: "lib",
        context: { batchStart: i, batchSize: batch.length },
      });
    }
  }

  return { entity: "inventory", count, durationMs: Date.now() - started, errors };
}

export async function syncRecentInventory(_hoursBack: number): Promise<SyncResult> {
  // Inventory doesn't have a cheap "since" — just refresh everything.
  // If this becomes slow, keep a per-variation updated_at and filter.
  return backfillInventory();
}
