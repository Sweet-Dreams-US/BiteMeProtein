import { getAdminSupabase } from "./supabase-admin";
import { getSquareClient, withRetry } from "./square-client";
import { logError } from "@/lib/log-error";
import type { SyncResult } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function upsertLocation(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();
  const row = {
    id: raw.id,
    name: raw.name ?? null,
    status: raw.status ?? null,
    address: raw.address ?? null,
    raw,
    synced_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("square_locations").upsert(row, { onConflict: "id" });
  if (error) {
    await logError(error, {
      path: "lib/sync/locations.ts:upsertLocation",
      source: "lib",
      context: { locationId: raw.id },
    });
  }
}

export async function backfillLocations(): Promise<SyncResult> {
  const started = Date.now();
  const client = getSquareClient();
  let count = 0;
  let errors = 0;

  try {
    const resp: any = await withRetry(() => (client.locations as any).list(), "locations.list");
    for (const loc of resp.locations ?? []) {
      await upsertLocation(loc);
      count++;
    }
  } catch (err) {
    errors++;
    await logError(err, { path: "lib/sync/locations.ts:backfillLocations", source: "lib" });
  }

  return { entity: "locations", count, durationMs: Date.now() - started, errors };
}

export async function syncRecentLocations(_hoursBack: number): Promise<SyncResult> {
  return backfillLocations(); // Locations list is tiny; always full-sync.
}
