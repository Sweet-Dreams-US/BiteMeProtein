import { getSquareClient } from "@/lib/square";
import crypto from "crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Square Loyalty helpers.
 *
 * Lazy pattern: if Haley hasn't configured a loyalty program in the
 * Square Seller Dashboard yet, these functions silently no-op. Once
 * she sets one up, every subsequent order automatically accrues points
 * with zero code changes.
 *
 * The universal loyalty key is **phone number** — Square auto-creates
 * accounts on first visit and merges online + in-person POS activity.
 *
 * SDK NAVIGATION (Square v44):
 *   client.loyalty.programs.get({ programId: "main" })
 *   client.loyalty.accounts.search({ query: { mappings: [...] }})
 *   client.loyalty.accounts.create({ loyaltyAccount: {...} })
 *   client.loyalty.accounts.accumulatePoints({...})
 */

// Cache program ID with a TTL so we don't miss new program activation.
// 5-min TTL: if Haley sets up loyalty in Square Dashboard, the site
// picks it up within 5 minutes without a redeploy.
const PROGRAM_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedProgramId: string | null = null;
let cachedProgramExpiresAt = 0;

/**
 * Returns the active loyalty program ID, or null if none is configured.
 * Cached for 5 minutes per server instance.
 */
export async function getLoyaltyProgramId(): Promise<string | null> {
  if (Date.now() < cachedProgramExpiresAt) return cachedProgramId;

  try {
    const client = getSquareClient();
    const resp: any = await client.loyalty.programs.get({ programId: "main" });
    const id: string | null = resp.program?.id || null;
    cachedProgramId = id;
    cachedProgramExpiresAt = Date.now() + PROGRAM_CACHE_TTL_MS;
    return id;
  } catch (err) {
    console.error("[loyalty] getProgramId failed:", err instanceof Error ? err.message : err);
    cachedProgramId = null;
    cachedProgramExpiresAt = Date.now() + PROGRAM_CACHE_TTL_MS;
    return null;
  }
}

/**
 * Find or create a loyalty account for a phone number.
 * Returns null if no program exists or phone is missing/invalid.
 */
export async function findOrCreateLoyaltyAccount(phoneNumber: string): Promise<string | null> {
  const phone = normalizePhone(phoneNumber);
  if (!phone) return null;

  const programId = await getLoyaltyProgramId();
  if (!programId) return null;

  try {
    const client = getSquareClient();

    // Search for existing account by phone
    const searchResp: any = await client.loyalty.accounts.search({
      query: {
        mappings: [{ phoneNumber: phone }],
      },
    });

    const existing = searchResp.loyaltyAccounts?.[0];
    if (existing?.id) return existing.id;

    // Create new account
    const createResp: any = await client.loyalty.accounts.create({
      loyaltyAccount: {
        programId,
        mapping: { phoneNumber: phone },
      },
      idempotencyKey: crypto.randomUUID(),
    });

    return createResp.loyaltyAccount?.id || null;
  } catch (err) {
    console.error("[loyalty] findOrCreateLoyaltyAccount failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Accumulate points for a completed order. Idempotent: safe to call
 * more than once per order (Square dedupes by idempotencyKey).
 */
export async function accumulatePointsForOrder(params: {
  phoneNumber: string;
  orderId: string;
  locationId: string;
}): Promise<number | null> {
  const accountId = await findOrCreateLoyaltyAccount(params.phoneNumber);
  if (!accountId) return null;

  try {
    const client = getSquareClient();
    const resp: any = await client.loyalty.accounts.accumulatePoints({
      accountId,
      accumulatePoints: {
        orderId: params.orderId,
      },
      idempotencyKey: `order-${params.orderId}`, // stable key per order
      locationId: params.locationId,
    });

    // Return points earned (if surfaced in response)
    return resp.event?.accumulatePoints?.points
      ?? resp.events?.[0]?.accumulatePoints?.points
      ?? null;
  } catch (err) {
    console.error("[loyalty] accumulatePoints failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Get a customer's current loyalty balance by phone number.
 * Returns null if no program or no account exists for this phone.
 */
export async function getLoyaltyBalance(phoneNumber: string): Promise<{
  points: number;
  lifetimePoints: number;
  accountId: string;
} | null> {
  const phone = normalizePhone(phoneNumber);
  if (!phone) return null;

  const programId = await getLoyaltyProgramId();
  if (!programId) return null;

  try {
    const client = getSquareClient();
    const searchResp: any = await client.loyalty.accounts.search({
      query: {
        mappings: [{ phoneNumber: phone }],
      },
    });

    const account = searchResp.loyaltyAccounts?.[0];
    if (!account) return null;

    return {
      points: account.balance ?? 0,
      lifetimePoints: account.lifetimePoints ?? 0,
      accountId: account.id,
    };
  } catch (err) {
    console.error("[loyalty] getBalance failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Get the loyalty program's reward tiers so we can show "spend X points for Y" on the UI.
 */
export async function getLoyaltyProgram(): Promise<{
  id: string;
  terminology: { one: string; other: string };
  rewardTiers: Array<{
    id: string;
    name: string;
    points: number;
  }>;
} | null> {
  try {
    const client = getSquareClient();
    const resp: any = await client.loyalty.programs.get({ programId: "main" });
    const program = resp.program;
    if (!program) return null;

    return {
      id: program.id,
      terminology: {
        one: program.terminology?.one || "Point",
        other: program.terminology?.other || "Points",
      },
      rewardTiers: (program.rewardTiers || []).map((tier: any) => ({
        id: tier.id,
        name: tier.name,
        points: tier.points,
      })),
    };
  } catch (err) {
    console.error("[loyalty] getProgram failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX for US).
 * Returns null if it can't be parsed.
 */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}
