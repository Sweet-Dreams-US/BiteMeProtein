/**
 * scripts/backfill.ts
 *
 * Full-history load from Square into Supabase. Run once after applying
 * migrations to bootstrap the mirrors, or again any time you want to
 * reconcile drift.
 *
 * Usage:
 *   npm run backfill                   — all entities
 *   npm run backfill -- orders         — single entity
 *   npm run backfill -- orders,payments — comma-separated list
 *
 * Reads env from process.env (dotenv-flow style). Set .env.local with
 * production service-role key before running.
 */

import { backfillOrders } from "../lib/sync/orders";
import { backfillPayments } from "../lib/sync/payments";
import { backfillRefunds } from "../lib/sync/refunds";
import { backfillCustomers } from "../lib/sync/customers";
import { backfillCatalog } from "../lib/sync/catalog";
import { backfillLoyalty } from "../lib/sync/loyalty";
import { backfillInventory } from "../lib/sync/inventory";
import { backfillLocations } from "../lib/sync/locations";
import { backfillTierC } from "../lib/sync/tier-c";
import type { SyncResult } from "../lib/sync/types";

type Entity =
  | "customers"
  | "catalog"
  | "locations"
  | "orders"
  | "payments"
  | "refunds"
  | "loyalty"
  | "inventory"
  | "tier-c";

// Ordered so foreign-keys resolve cleanly: customers + catalog + locations
// before orders/payments (which reference them).
const ORDER: Entity[] = [
  "customers",
  "catalog",
  "locations",
  "orders",
  "payments",
  "refunds",
  "loyalty",
  "inventory",
  "tier-c",
];

async function runOne(e: Entity): Promise<SyncResult[]> {
  switch (e) {
    case "customers": return [await backfillCustomers()];
    case "catalog": return [await backfillCatalog()];
    case "locations": return [await backfillLocations()];
    case "orders": return [await backfillOrders()];
    case "payments": return [await backfillPayments()];
    case "refunds": return [await backfillRefunds()];
    case "loyalty": return [await backfillLoyalty()];
    case "inventory": return [await backfillInventory()];
    case "tier-c": return await backfillTierC();
  }
}

function fmt(r: SyncResult): string {
  const secs = (r.durationMs / 1000).toFixed(1);
  const status = r.errors > 0 ? `⚠ ${r.errors} errors` : "✓";
  return `  ${status}  ${r.entity.padEnd(20)} ${String(r.count).padStart(6)} rows  ${secs}s`;
}

async function main() {
  const arg = process.argv[2];
  const entities: Entity[] = arg
    ? (arg.split(",").map((s) => s.trim()) as Entity[])
    : ORDER;

  console.log(`\n🔄 Backfill starting — ${entities.length} entities\n`);
  const started = Date.now();
  const all: SyncResult[] = [];

  for (const e of entities) {
    console.log(`▸ ${e}…`);
    try {
      const results = await runOne(e);
      for (const r of results) {
        console.log(fmt(r));
        all.push(r);
      }
    } catch (err) {
      console.error(`  ✗ ${e} failed:`, err instanceof Error ? err.message : err);
    }
  }

  const totalSecs = ((Date.now() - started) / 1000).toFixed(1);
  const totalRows = all.reduce((acc, r) => acc + r.count, 0);
  const totalErrors = all.reduce((acc, r) => acc + r.errors, 0);
  console.log(`\n✅ Done in ${totalSecs}s — ${totalRows} rows, ${totalErrors} errors\n`);
  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
