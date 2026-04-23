import { getAdminSupabase } from "./supabase-admin";
import { stripBigInts } from "./json-safe";
import { getSquareClient, paginate, withRetry } from "./square-client";
import { logError } from "@/lib/log-error";
import type { SyncResult } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Tier-C entities: gift cards, disputes, cash drawer shifts, team members,
 * invoices. Low-volume, rarely touched — keep the handlers minimal.
 */

function toCents(money: { amount?: number | string | bigint } | undefined): number | null {
  if (!money?.amount) return null;
  try { return Number(money.amount); } catch { return null; }
}

// ── gift cards ─────────────────────────────────────────────────────────────

export async function upsertGiftCard(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();
  const { error } = await supabase.from("square_gift_cards").upsert({
    id: raw.id,
    type: raw.type ?? null,
    state: raw.state ?? null,
    balance_cents: toCents(raw.balanceMoney),
    created_at: raw.createdAt ?? null,
    raw: stripBigInts(raw),
    synced_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) await logError(error, { path: "lib/sync/tier-c.ts:upsertGiftCard", source: "lib", context: { giftCardId: raw.id } });
}

async function backfillGiftCards(): Promise<SyncResult> {
  const started = Date.now();
  const client = getSquareClient();
  let count = 0; let errors = 0;
  try {
    const iter = paginate(
      (req) => withRetry(() => (client as any).giftCards?.list?.(req), "giftCards.list"),
      (resp: any) => resp?.giftCards,
      { limit: 50 },
    );
    for await (const gc of iter) { await upsertGiftCard(gc); count++; }
  } catch (err) { errors++; await logError(err, { path: "lib/sync/tier-c.ts:backfillGiftCards", source: "lib" }); }
  return { entity: "gift_cards", count, durationMs: Date.now() - started, errors };
}

// ── disputes ───────────────────────────────────────────────────────────────

export async function upsertDispute(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();
  const { error } = await supabase.from("square_disputes").upsert({
    id: raw.id,
    payment_id: raw.disputedPayment?.paymentId ?? null,
    amount_cents: toCents(raw.amountMoney),
    reason: raw.reason ?? null,
    state: raw.state ?? null,
    due_at: raw.dueAt ?? null,
    created_at: raw.createdAt ?? null,
    raw: stripBigInts(raw),
    synced_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) await logError(error, { path: "lib/sync/tier-c.ts:upsertDispute", source: "lib", context: { disputeId: raw.id } });
}

async function backfillDisputes(): Promise<SyncResult> {
  const started = Date.now();
  const client = getSquareClient();
  let count = 0; let errors = 0;
  try {
    const iter = paginate(
      (req) => withRetry(() => (client as any).disputes?.list?.(req), "disputes.list"),
      (resp: any) => resp?.disputes,
      {},
    );
    for await (const d of iter) { await upsertDispute(d); count++; }
  } catch (err) { errors++; await logError(err, { path: "lib/sync/tier-c.ts:backfillDisputes", source: "lib" }); }
  return { entity: "disputes", count, durationMs: Date.now() - started, errors };
}

// ── cash drawer shifts ─────────────────────────────────────────────────────

export async function upsertCashDrawerShift(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();
  const { error } = await supabase.from("square_cash_drawer_shifts").upsert({
    id: raw.id,
    state: raw.state ?? null,
    opened_at: raw.openedAt ?? null,
    closed_at: raw.closedAt ?? null,
    opened_cash_money_cents: toCents(raw.openedCashMoney),
    closed_cash_money_cents: toCents(raw.closedCashMoney),
    raw: stripBigInts(raw),
    synced_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) await logError(error, { path: "lib/sync/tier-c.ts:upsertCashDrawerShift", source: "lib", context: { shiftId: raw.id } });
}

async function backfillCashDrawerShifts(): Promise<SyncResult> {
  const started = Date.now();
  const client = getSquareClient();
  const locationId = process.env.SQUARE_LOCATION_ID!;
  let count = 0; let errors = 0;
  try {
    const iter = paginate(
      (req) => withRetry(() => (client as any).cashDrawers?.listShifts?.(req), "cashDrawers.listShifts"),
      (resp: any) => resp?.cashDrawerShifts,
      { locationId, sortOrder: "DESC", limit: 100 },
    );
    for await (const s of iter) { await upsertCashDrawerShift(s); count++; }
  } catch (err) { errors++; await logError(err, { path: "lib/sync/tier-c.ts:backfillCashDrawerShifts", source: "lib" }); }
  return { entity: "cash_drawer_shifts", count, durationMs: Date.now() - started, errors };
}

// ── team members ───────────────────────────────────────────────────────────

export async function upsertTeamMember(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();
  const { error } = await supabase.from("square_team_members").upsert({
    id: raw.id,
    given_name: raw.givenName ?? null,
    family_name: raw.familyName ?? null,
    email: raw.emailAddress ?? null,
    status: raw.status ?? null,
    is_owner: raw.isOwner ?? false,
    created_at: raw.createdAt ?? null,
    raw: stripBigInts(raw),
    synced_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) await logError(error, { path: "lib/sync/tier-c.ts:upsertTeamMember", source: "lib", context: { teamMemberId: raw.id } });
}

async function backfillTeamMembers(): Promise<SyncResult> {
  const started = Date.now();
  const client = getSquareClient();
  let count = 0; let errors = 0;
  try {
    const iter = paginate(
      (req) => withRetry(() => (client as any).teamMembers?.search?.(req), "teamMembers.search"),
      (resp: any) => resp?.teamMembers,
      { limit: 100 },
    );
    for await (const t of iter) { await upsertTeamMember(t); count++; }
  } catch (err) { errors++; await logError(err, { path: "lib/sync/tier-c.ts:backfillTeamMembers", source: "lib" }); }
  return { entity: "team_members", count, durationMs: Date.now() - started, errors };
}

// ── invoices ───────────────────────────────────────────────────────────────

export async function upsertInvoice(raw: any): Promise<void> {
  if (!raw?.id) return;
  const supabase = getAdminSupabase();
  const { error } = await supabase.from("square_invoices").upsert({
    id: raw.id,
    order_id: raw.orderId ?? null,
    status: raw.status ?? null,
    total_cents: toCents(raw.nextPaymentAmountMoney ?? raw.paymentRequests?.[0]?.computedAmountMoney),
    due_date: raw.paymentRequests?.[0]?.dueDate ?? null,
    created_at: raw.createdAt ?? null,
    updated_at: raw.updatedAt ?? null,
    raw: stripBigInts(raw),
    synced_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) await logError(error, { path: "lib/sync/tier-c.ts:upsertInvoice", source: "lib", context: { invoiceId: raw.id } });
}

async function backfillInvoices(): Promise<SyncResult> {
  const started = Date.now();
  const client = getSquareClient();
  const locationId = process.env.SQUARE_LOCATION_ID!;
  let count = 0; let errors = 0;
  try {
    const iter = paginate(
      (req) => withRetry(() => (client as any).invoices?.search?.(req), "invoices.search"),
      (resp: any) => resp?.invoices,
      { query: { filter: { locationIds: [locationId] } }, limit: 100 },
    );
    for await (const inv of iter) { await upsertInvoice(inv); count++; }
  } catch (err) { errors++; await logError(err, { path: "lib/sync/tier-c.ts:backfillInvoices", source: "lib" }); }
  return { entity: "invoices", count, durationMs: Date.now() - started, errors };
}

// ── barrel ─────────────────────────────────────────────────────────────────

export async function backfillTierC(): Promise<SyncResult[]> {
  return [
    await backfillGiftCards(),
    await backfillDisputes(),
    await backfillCashDrawerShifts(),
    await backfillTeamMembers(),
    await backfillInvoices(),
  ];
}

export async function syncRecentTierC(_hoursBack: number): Promise<SyncResult[]> {
  // Tier-C entities change rarely; full refresh is cheap.
  return backfillTierC();
}
