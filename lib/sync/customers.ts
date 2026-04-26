import { getAdminSupabase } from "./supabase-admin";
import { stripBigInts } from "./json-safe";
import { iterateRest } from "./square-rest";
import { logError } from "@/lib/log-error";
import type { SyncResult } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Square customer sync.
 *
 * Uses Square's REST customers endpoint directly (not the v44 SDK) because
 * the SDK transforms the response shape in a way our paginate() helper
 * can't read — see lib/sync/square-rest.ts for context. Field names in
 * REST responses are snake_case (email_address, phone_number, etc.) so
 * upsertCustomer accepts both shapes for safety.
 */
export async function upsertCustomer(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();

  // Accept both REST (snake_case) and SDK / webhook (camelCase) shapes —
  // webhook payloads also vary by Square API version. The ?? chain picks
  // whichever is present.
  const email = raw.email_address ?? raw.emailAddress ?? null;
  const phone = raw.phone_number ?? raw.phoneNumber ?? null;
  const givenName = raw.given_name ?? raw.givenName ?? null;
  const familyName = raw.family_name ?? raw.familyName ?? null;
  const companyName = raw.company_name ?? raw.companyName ?? null;
  const referenceId = raw.reference_id ?? raw.referenceId ?? null;
  const createdAt = raw.created_at ?? raw.createdAt ?? null;
  const updatedAt = raw.updated_at ?? raw.updatedAt ?? null;

  const row = {
    id: raw.id,
    created_at: createdAt,
    updated_at: updatedAt,
    email,
    phone,
    given_name: givenName,
    family_name: familyName,
    company_name: companyName,
    reference_id: referenceId,
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

export async function backfillCustomers(): Promise<SyncResult> {
  const started = Date.now();
  let count = 0;
  let errors = 0;

  for await (const customer of iterateRest<any>({
    path: "/v2/customers",
    query: { sort_field: "CREATED_AT", sort_order: "DESC", limit: "100" },
    itemsKey: "customers",
    label: "customers.list",
  })) {
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
  // Square's /v2/customers endpoint doesn't cleanly support "since" filter
  // beyond what /v2/customers/search provides. For typical bakery-scale
  // customer lists, full backfill is fast enough. If this ever hurts,
  // switch to /v2/customers/search with updated_at filter.
  return backfillCustomers();
}
