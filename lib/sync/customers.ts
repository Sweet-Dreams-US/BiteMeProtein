import { getAdminSupabase } from "./supabase-admin";
import { stripBigInts } from "./json-safe";
import { getSquareClient, paginate, withRetry } from "./square-client";
import { logError } from "@/lib/log-error";
import type { SyncResult } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function upsertCustomer(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();

  const row = {
    id: raw.id,
    created_at: raw.createdAt ?? null,
    updated_at: raw.updatedAt ?? null,
    email: raw.emailAddress ?? null,
    phone: raw.phoneNumber ?? null,
    given_name: raw.givenName ?? null,
    family_name: raw.familyName ?? null,
    company_name: raw.companyName ?? null,
    reference_id: raw.referenceId ?? null,
    raw: stripBigInts(raw),
    synced_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("square_customers").upsert(row, { onConflict: "id" });
  if (error) {
    await logError(error, {
      path: "lib/sync/customers.ts:upsertCustomer",
      source: "lib",
      context: { customerId: raw.id },
    });
  }
}

async function* iterateCustomers(): AsyncGenerator<any> {
  const client = getSquareClient();
  yield* paginate(
    (req) => withRetry(() => (client.customers as any).list(req), "customers.list"),
    (resp: any) => resp.customers,
    { sortField: "CREATED_AT", sortOrder: "DESC", limit: 100 },
  );
}

export async function backfillCustomers(): Promise<SyncResult> {
  const started = Date.now();
  let count = 0;
  let errors = 0;

  for await (const customer of iterateCustomers()) {
    try {
      await upsertCustomer(customer);
      count++;
    } catch (err) {
      errors++;
      await logError(err, { path: "lib/sync/customers.ts:backfillCustomers", source: "lib" });
    }
  }

  return { entity: "customers", count, durationMs: Date.now() - started, errors };
}

export async function syncRecentCustomers(_hoursBack: number): Promise<SyncResult> {
  // Square customers.list doesn't cleanly support "since" filter. Backfill
  // pages through all — fine for typical bakery-scale customer lists.
  // If this ever hurts, use customers.search with updatedAt filter.
  return backfillCustomers();
}
