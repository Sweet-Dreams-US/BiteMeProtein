import { getAdminSupabase } from "./supabase-admin";
import { stripBigInts } from "./json-safe";
import { getSquareClient, paginate, withRetry } from "./square-client";
import { logError } from "@/lib/log-error";
import type { SyncResult } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function upsertLoyaltyAccount(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();

  const row = {
    id: raw.id,
    customer_id: raw.customerId ?? null,
    phone: raw.mapping?.phoneNumber ?? null,
    program_id: raw.programId ?? null,
    balance: raw.balance ?? 0,
    lifetime_points: raw.lifetimePoints ?? 0,
    created_at: raw.createdAt ?? null,
    updated_at: raw.updatedAt ?? null,
    raw: stripBigInts(raw),
    synced_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("square_loyalty_accounts").upsert(row, { onConflict: "id" });
  if (error) {
    await logError(error, {
      path: "lib/sync/loyalty.ts:upsertLoyaltyAccount",
      source: "lib",
      context: { accountId: raw.id },
    });
  }
}

export async function upsertLoyaltyEvent(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();

  const row = {
    id: raw.id,
    account_id: raw.loyaltyAccountId ?? null,
    type: raw.type ?? null,
    points:
      raw.accumulatePoints?.points ??
      raw.adjustPoints?.points ??
      raw.redeemReward?.points ??
      null,
    order_id: raw.accumulatePoints?.orderId ?? null,
    created_at: raw.createdAt ?? new Date().toISOString(),
    raw: stripBigInts(raw),
    synced_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("square_loyalty_events").upsert(row, { onConflict: "id" });
  if (error) {
    await logError(error, {
      path: "lib/sync/loyalty.ts:upsertLoyaltyEvent",
      source: "lib",
      context: { eventId: raw.id },
    });
  }
}

async function* iterateLoyaltyAccounts(): AsyncGenerator<any> {
  const client = getSquareClient();
  yield* paginate(
    (req) => withRetry(() => client.loyalty.accounts.search(req), "loyalty.accounts.search"),
    (resp: any) => resp.loyaltyAccounts,
    { limit: 200 },
  );
}

async function* iterateLoyaltyEvents(since?: Date): AsyncGenerator<any> {
  const client = getSquareClient();
  yield* paginate(
    (req) => withRetry(() => (client.loyalty as any).events.search(req), "loyalty.events.search"),
    (resp: any) => resp.events,
    {
      query: since ? { filter: { dateTimeFilter: { createdAt: { startAt: since.toISOString() } } } } : undefined,
      limit: 100,
    },
  );
}

export async function backfillLoyalty(): Promise<SyncResult> {
  const started = Date.now();
  let count = 0;
  let errors = 0;

  // Accounts first
  for await (const acc of iterateLoyaltyAccounts()) {
    try { await upsertLoyaltyAccount(acc); count++; }
    catch (err) { errors++; await logError(err, { path: "lib/sync/loyalty.ts:accounts", source: "lib" }); }
  }

  // Then events
  for await (const ev of iterateLoyaltyEvents()) {
    try { await upsertLoyaltyEvent(ev); count++; }
    catch (err) { errors++; await logError(err, { path: "lib/sync/loyalty.ts:events", source: "lib" }); }
  }

  return { entity: "loyalty", count, durationMs: Date.now() - started, errors };
}

export async function syncRecentLoyalty(hoursBack: number): Promise<SyncResult> {
  const started = Date.now();
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  let count = 0;
  let errors = 0;

  // Recent syncs focus on events (new accrual/redeem). Accounts re-sync via webhook.
  for await (const ev of iterateLoyaltyEvents(since)) {
    try { await upsertLoyaltyEvent(ev); count++; }
    catch (err) { errors++; await logError(err, { path: "lib/sync/loyalty.ts:syncRecent", source: "lib" }); }
  }

  return { entity: "loyalty", count, durationMs: Date.now() - started, errors };
}
