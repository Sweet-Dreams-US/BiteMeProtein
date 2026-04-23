/**
 * Next.js runs this file once per serverless function cold start, before
 * any route handler executes. Reserved for process-wide init; currently
 * empty.
 *
 * NOTE: We previously shimmed BigInt.prototype.toJSON here to fix
 * Supabase writes of Square raw responses. That shim broke the OPPOSITE
 * direction — Square's SDK sends amounts as BigInt in request bodies and
 * Square's API expects them as JSON integers, not strings. The shim
 * turned them into strings globally and Square rejected with "Expected
 * an integer value".
 *
 * The correct fix lives in lib/sync/json-safe.ts, applied per-call at
 * Supabase write sites only, so outbound Square requests keep their
 * BigInt-as-number serialization.
 */

export async function register() {
  // Intentionally empty — see note above.
}
