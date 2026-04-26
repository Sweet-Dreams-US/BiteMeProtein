import { getAdminSupabase } from "./supabase-admin";
import { stripBigInts } from "./json-safe";
import { iterateRest } from "./square-rest";
import { logError } from "@/lib/log-error";
import type { SyncResult } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Square refund sync.
 *
 * Uses Square's REST refunds endpoint directly (not the v44 SDK) — the
 * SDK paginator transforms the response shape and our sync ends up
 * iterating zero items silently. See lib/sync/square-rest.ts for context.
 *
 * REST returns snake_case fields; webhook payloads (also routed through
 * upsertRefund) come in camelCase. Reader normalizes both shapes.
 */

function toCents(money: { amount?: number | string | bigint } | undefined): number | null {
  if (!money?.amount) return null;
  try { return Number(money.amount); } catch { return null; }
}

export async function upsertRefund(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();

  const paymentId = raw.payment_id ?? raw.paymentId ?? null;
  const orderId = raw.order_id ?? raw.orderId ?? null;
  const createdAt = raw.created_at ?? raw.createdAt ?? new Date().toISOString();
  const amountMoney = raw.amount_money ?? raw.amountMoney;

  const row = {
    id: raw.id,
    payment_id: paymentId,
    order_id: orderId,
    created_at: createdAt,
    amount_cents: toCents(amountMoney),
    reason: raw.reason ?? null,
    status: raw.status ?? null,
    raw: stripBigInts(raw),
    synced_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("square_refunds").upsert(row, { onConflict: "id" });
  if (error) {
    await logError(error, {
      path: "lib/sync/refunds.ts:upsertRefund",
      source: "lib",
      context: { refundId: raw.id },
    });
  }
}

export async function backfillRefunds(since?: Date): Promise<SyncResult> {
  const started = Date.now();
  let count = 0;
  let errors = 0;

  // Square's /v2/refunds query supports begin_time as the cursor for
  // "since". Format: ISO 8601. Empty when not specified — pulls all.
  const query: Record<string, string> = {
    sort_order: "DESC",
    limit: "100",
  };
  if (since) query.begin_time = since.toISOString();

  for await (const refund of iterateRest<any>({
    path: "/v2/refunds",
    query,
    itemsKey: "refunds",
    label: "refunds.list",
  })) {
    try {
      await upsertRefund(refund);
      count++;
    } catch (err) {
      errors++;
      await logError(err, { path: "lib/sync/refunds.ts:backfillRefunds", source: "lib" });
    }
  }

  return { entity: "refunds", count, durationMs: Date.now() - started, errors };
}

export async function syncRecentRefunds(hoursBack: number): Promise<SyncResult> {
  return backfillRefunds(new Date(Date.now() - hoursBack * 60 * 60 * 1000));
}
