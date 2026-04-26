import { logError } from "@/lib/log-error";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Direct REST helpers for Square endpoints whose SDK shape isn't
 * compatible with our paginate() generator.
 *
 * The Square TypeScript SDK v44 introduced a paginator object whose array
 * lives at `.data`, while the REST API returns `{ <entity>: [...], cursor
 * }`. Our paginate() helper expects the REST shape, so for endpoints where
 * the SDK transformed the response (notably customers + refunds), we
 * bypass the SDK and hit REST directly. Cleaner than fighting the SDK's
 * generated types and avoids the silent "iterates 0 items" failure mode.
 */

const SQUARE_BASE = "https://connect.squareup.com";
const SQUARE_VERSION = "2024-10-17";

function token(): string {
  const t = process.env.SQUARE_ACCESS_TOKEN?.trim();
  if (!t) throw new Error("SQUARE_ACCESS_TOKEN is not configured");
  return t;
}

/**
 * Iterate Square REST collection endpoints that return
 * `{ <itemsKey>: [...], cursor: string | null }`. The cursor parameter is
 * carried over via query string. Stops when the API stops returning a
 * cursor.
 */
export async function* iterateRest<T>(opts: {
  path: string;
  query?: Record<string, string>;
  itemsKey: string;
  /** Operation label for logs. Defaults to GET <path>. */
  label?: string;
}): AsyncGenerator<T> {
  const label = opts.label ?? `GET ${opts.path}`;
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      ...(opts.query ?? {}),
      ...(cursor ? { cursor } : {}),
    });
    const url = `${SQUARE_BASE}${opts.path}?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        "Square-Version": SQUARE_VERSION,
        "Authorization": `Bearer ${token()}`,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      await logError(`Square REST ${label} ${res.status}: ${body.slice(0, 500)}`, {
        path: `lib/sync/square-rest.ts:${label}`,
        source: "lib",
        context: { status: res.status },
      });
      return;
    }

    const data = await res.json();
    const items: T[] = data[opts.itemsKey] ?? [];
    for (const item of items) yield item;

    if (!data.cursor) return;
    cursor = data.cursor;
  }
}
