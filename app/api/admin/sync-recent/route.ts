import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { logError } from "@/lib/log-error";
import { syncRecentOrders } from "@/lib/sync/orders";
import { syncRecentPayments } from "@/lib/sync/payments";
import { syncRecentRefunds } from "@/lib/sync/refunds";
import { syncRecentCustomers } from "@/lib/sync/customers";
import { syncRecentCatalog } from "@/lib/sync/catalog";
import { syncRecentLoyalty } from "@/lib/sync/loyalty";
import { syncRecentInventory } from "@/lib/sync/inventory";
import { syncRecentLocations } from "@/lib/sync/locations";
import { syncRecentTierC } from "@/lib/sync/tier-c";
import type { SyncResult } from "@/lib/sync/types";

/**
 * POST /api/admin/sync-recent
 *
 * On-admin-reload fallback for when webhooks miss events. Admin hits
 * this on dashboard mount; it refetches the last N hours of changes
 * per entity and upserts them. Idempotent — duplicate data becomes
 * the same row.
 *
 * Body:
 *   { entities?: string[], hoursBack?: number }
 *
 * If entities is omitted, syncs ORDERS + PAYMENTS + REFUNDS (the three
 * most-valuable-to-be-fresh entities). Full list requires passing them
 * explicitly to keep dashboard mount fast.
 */

type EntityKey =
  | "orders"
  | "payments"
  | "refunds"
  | "customers"
  | "catalog"
  | "loyalty"
  | "inventory"
  | "locations"
  | "tier-c";

const DEFAULT_ENTITIES: EntityKey[] = ["orders", "payments", "refunds"];
const DEFAULT_HOURS = 24;

async function runEntity(entity: EntityKey, hoursBack: number): Promise<SyncResult[]> {
  switch (entity) {
    case "orders": return [await syncRecentOrders(hoursBack)];
    case "payments": return [await syncRecentPayments(hoursBack)];
    case "refunds": return [await syncRecentRefunds(hoursBack)];
    case "customers": return [await syncRecentCustomers(hoursBack)];
    case "catalog": return [await syncRecentCatalog(hoursBack)];
    case "loyalty": return [await syncRecentLoyalty(hoursBack)];
    case "inventory": return [await syncRecentInventory(hoursBack)];
    case "locations": return [await syncRecentLocations(hoursBack)];
    case "tier-c": return await syncRecentTierC(hoursBack);
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => ({}));
    const entities: EntityKey[] = Array.isArray(body.entities) && body.entities.length > 0
      ? body.entities.filter((e: string) =>
          ["orders", "payments", "refunds", "customers", "catalog", "loyalty", "inventory", "locations", "tier-c"].includes(e),
        )
      : DEFAULT_ENTITIES;
    const hoursBack = Number.isFinite(body.hoursBack) ? Number(body.hoursBack) : DEFAULT_HOURS;

    const results: SyncResult[] = [];
    for (const entity of entities) {
      try {
        const r = await runEntity(entity, hoursBack);
        results.push(...r);
      } catch (err) {
        await logError(err, {
          path: "/api/admin/sync-recent",
          source: "api-route",
          context: { entity, hoursBack },
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    await logError(err, { path: "/api/admin/sync-recent", source: "api-route" });
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
