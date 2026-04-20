import { getSquareClient } from "@/lib/square";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Pagination helper for Square endpoints that return `cursor` in responses.
 *
 * Usage:
 *   const client = getSquareClient();
 *   for await (const order of paginate(
 *     (req) => client.orders.search(req),
 *     (resp) => resp.orders ?? [],
 *     { locationIds: ["X"], query: {...} }
 *   )) {
 *     await upsertOrder(order);
 *   }
 */
export async function* paginate<TItem, TResp extends { cursor?: string }>(
  fetchPage: (req: any) => Promise<TResp>,
  extractItems: (resp: TResp) => TItem[] | undefined,
  initialReq: Record<string, unknown>,
): AsyncGenerator<TItem, { count: number }, void> {
  let cursor: string | undefined;
  let count = 0;

  do {
    const req = cursor ? { ...initialReq, cursor } : initialReq;
    const resp = await fetchPage(req);
    const items = extractItems(resp) ?? [];
    for (const item of items) {
      yield item;
      count++;
    }
    cursor = resp.cursor;
  } while (cursor);

  return { count };
}

/**
 * Retry wrapper — Square occasionally rate-limits (HTTP 429) or 503s.
 * Exponential backoff, max 4 attempts.
 */
export async function withRetry<T>(fn: () => Promise<T>, label = "square-call"): Promise<T> {
  const maxAttempts = 4;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.statusCode || err?.response?.status;
      const isRetriable = status === 429 || status === 503 || status === 502;
      if (!isRetriable || attempt === maxAttempts) throw err;
      const delay = 2 ** attempt * 250; // 500, 1000, 2000 ms
      console.warn(`[${label}] attempt ${attempt} failed (${status}); retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export { getSquareClient };
