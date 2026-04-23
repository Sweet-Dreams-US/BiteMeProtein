/**
 * Convert any BigInt values in a nested object/array into strings so the
 * value can pass through JSON.stringify. Used specifically at Supabase
 * write sites when we dump Square raw responses into JSONB columns —
 * Square's SDK uses BigInt for money fields and Supabase's client calls
 * JSON.stringify internally.
 *
 * We do NOT patch BigInt.prototype globally because Square's own API
 * clients serialize money fields via the same JSON.stringify path when
 * sending requests; Square's backend expects integer JSON (not strings),
 * so a global shim would break every outbound payment.
 *
 * Money values we actually READ are converted to Number() via toCents()
 * before display, so the string representation in the raw dump is
 * debugging-only.
 */
export function stripBigInts<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") {
    return value.toString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(stripBigInts) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripBigInts(v);
    }
    return out as unknown as T;
  }
  return value;
}
