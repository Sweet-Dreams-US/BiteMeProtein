import { getAdminSupabase } from "./supabase-admin";
import { getSquareClient, paginate, withRetry } from "./square-client";
import { logError } from "@/lib/log-error";
import type { SyncResult } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function toCents(money: { amount?: number | string | bigint } | undefined): number | null {
  if (!money?.amount) return null;
  try { return Number(money.amount); } catch { return null; }
}

export async function upsertProduct(raw: any): Promise<void> {
  if (!raw?.id || raw.type !== "ITEM") return;
  const supabase = getAdminSupabase();

  const itemData = raw.itemData ?? {};
  const productRow = {
    id: raw.id,
    name: itemData.name ?? null,
    description: itemData.description ?? null,
    category_id: itemData.categoryId ?? null,
    is_archived: itemData.isArchived ?? false,
    updated_at: raw.updatedAt ?? null,
    raw,
    synced_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("square_products").upsert(productRow, { onConflict: "id" });
  if (error) {
    await logError(error, {
      path: "lib/sync/catalog.ts:upsertProduct",
      source: "lib",
      context: { productId: raw.id },
    });
    return;
  }

  // Variations
  const variations: any[] = itemData.variations ?? [];
  for (const v of variations) {
    if (!v?.id) continue;
    const vd = v.itemVariationData ?? {};
    const vRow = {
      id: v.id,
      product_id: raw.id,
      name: vd.name ?? null,
      price_cents: toCents(vd.priceMoney),
      sku: vd.sku ?? null,
      track_inventory: vd.trackInventory ?? false,
      raw: v,
      synced_at: new Date().toISOString(),
    };
    const { error: vErr } = await supabase.from("square_product_variations").upsert(vRow, { onConflict: "id" });
    if (vErr) {
      await logError(vErr, {
        path: "lib/sync/catalog.ts:upsertProduct:variation",
        source: "lib",
        context: { productId: raw.id, variationId: v.id },
      });
    }
  }
}

export async function upsertCategory(raw: any): Promise<void> {
  if (!raw?.id || raw.type !== "CATEGORY") return;
  const supabase = getAdminSupabase();

  const row = {
    id: raw.id,
    name: raw.categoryData?.name ?? null,
    raw,
    synced_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("square_catalog_categories").upsert(row, { onConflict: "id" });
  if (error) {
    await logError(error, {
      path: "lib/sync/catalog.ts:upsertCategory",
      source: "lib",
      context: { categoryId: raw.id },
    });
  }
}

export async function upsertModifier(raw: any): Promise<void> {
  if (!raw?.id || raw.type !== "MODIFIER") return;
  const supabase = getAdminSupabase();
  const md = raw.modifierData ?? {};

  const row = {
    id: raw.id,
    name: md.name ?? null,
    modifier_list_id: md.modifierListId ?? null,
    price_cents: toCents(md.priceMoney),
    raw,
    synced_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("square_catalog_modifiers").upsert(row, { onConflict: "id" });
  if (error) {
    await logError(error, {
      path: "lib/sync/catalog.ts:upsertModifier",
      source: "lib",
      context: { modifierId: raw.id },
    });
  }
}

async function* iterateCatalog(): AsyncGenerator<any> {
  const client = getSquareClient();
  yield* paginate(
    (req) => withRetry(() => (client.catalog as any).list(req), "catalog.list"),
    (resp: any) => resp.objects,
    { types: "ITEM,CATEGORY,MODIFIER" },
  );
}

export async function backfillCatalog(): Promise<SyncResult> {
  const started = Date.now();
  let count = 0;
  let errors = 0;

  for await (const obj of iterateCatalog()) {
    try {
      if (obj.type === "ITEM") await upsertProduct(obj);
      else if (obj.type === "CATEGORY") await upsertCategory(obj);
      else if (obj.type === "MODIFIER") await upsertModifier(obj);
      count++;
    } catch (err) {
      errors++;
      await logError(err, { path: "lib/sync/catalog.ts:backfillCatalog", source: "lib" });
    }
  }

  return { entity: "catalog", count, durationMs: Date.now() - started, errors };
}

export async function syncRecentCatalog(_hoursBack: number): Promise<SyncResult> {
  // Catalog is small and changes rarely; a full resync is cheap and correct.
  return backfillCatalog();
}
