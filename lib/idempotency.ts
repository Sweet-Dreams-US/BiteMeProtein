import crypto from "crypto";

/**
 * Derives a pair of Square idempotency keys from one client-generated key.
 *
 * The client passes a stable UUID (scoped to one checkout attempt via
 * sessionStorage). The server derives two keys — one for orders.create,
 * one for payments.create — so a double-click or network retry on the
 * same checkout attempt deduplicates at Square, not at the browser.
 *
 * Square's idempotency keys are capped at 45 characters. UUIDs are 36; the
 * "-o" / "-p" suffix keeps both keys comfortably under the limit.
 *
 * If the client key is missing or malformed (from a stale client, a bad
 * actor, or a non-browser caller), a fresh UUID is used — retries just
 * won't dedupe in that case, which is safer than rejecting the request.
 */
export function deriveIdempotencyKeys(clientKey: string | undefined | null): {
  order: string;
  payment: string;
} {
  const base = clientKey && /^[a-zA-Z0-9-]{8,40}$/.test(clientKey)
    ? clientKey
    : crypto.randomUUID();
  return { order: `${base}-o`, payment: `${base}-p` };
}
