import { getAdminSupabase } from "./supabase-admin";
import { stripBigInts } from "./json-safe";
import { getSquareClient, paginate, withRetry } from "./square-client";
import { logError } from "@/lib/log-error";
import type { SyncResult } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function toCents(money: { amount?: number | string | bigint } | undefined): number | null {
  if (!money?.amount) return null;
  try { return Number(money.amount); } catch { return null; }
}

export async function upsertRefund(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();

  const row = {
    id: raw.id,
    payment_id: raw.paymentId ?? null,
    order_id: raw.orderId ?? null,
    created_at: raw.createdAt ?? new Date().toISOString(),
    amount_cents: toCents(raw.amountMoney),
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

async function* iterateRefunds(since?: Date): AsyncGenerator<any> {
  const client = getSquareClient();
  const beginTime = since?.toISOString();

  yield* paginate(
    (req) => withRetry(() => (client.refunds as any).list(req), "refunds.list"),
    (resp: any) => resp.refunds,
    {
      ...(beginTime ? { beginTime } : {}),
      sortOrder: "DESC",
      limit: 100,
    },
  );
}

export async function backfillRefunds(since?: Date): Promise<SyncResult> {
  const started = Date.now();
  let count = 0;
  let errors = 0;

  for await (const refund of iterateRefunds(since)) {
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
