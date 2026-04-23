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

export async function upsertPayment(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();

  const row = {
    id: raw.id,
    order_id: raw.orderId ?? null,
    created_at: raw.createdAt ?? new Date().toISOString(),
    amount_cents: toCents(raw.amountMoney),
    source_type: raw.sourceType ?? null,    // CARD / CASH / EXTERNAL / BANK_ACCOUNT / GIFT_CARD
    card_brand: raw.cardDetails?.card?.cardBrand ?? null,
    card_last_4: raw.cardDetails?.card?.last4 ?? null,
    status: raw.status ?? null,
    receipt_url: raw.receiptUrl ?? null,
    raw: stripBigInts(raw),
    synced_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("square_payments").upsert(row, { onConflict: "id" });
  if (error) {
    await logError(error, {
      path: "lib/sync/payments.ts:upsertPayment",
      source: "lib",
      context: { paymentId: raw.id },
    });
  }
}

async function* iteratePayments(since?: Date): AsyncGenerator<any> {
  const client = getSquareClient();
  const beginTime = since?.toISOString();

  yield* paginate(
    (req) => withRetry(() => (client.payments as any).list(req), "payments.list"),
    (resp: any) => resp.payments,
    {
      ...(beginTime ? { beginTime } : {}),
      sortOrder: "DESC",
      limit: 100,
    },
  );
}

export async function backfillPayments(since?: Date): Promise<SyncResult> {
  const started = Date.now();
  let count = 0;
  let errors = 0;

  for await (const payment of iteratePayments(since)) {
    try {
      await upsertPayment(payment);
      count++;
    } catch (err) {
      errors++;
      await logError(err, { path: "lib/sync/payments.ts:backfillPayments", source: "lib" });
    }
  }

  return { entity: "payments", count, durationMs: Date.now() - started, errors };
}

export async function syncRecentPayments(hoursBack: number): Promise<SyncResult> {
  return backfillPayments(new Date(Date.now() - hoursBack * 60 * 60 * 1000));
}
