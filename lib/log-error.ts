import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Centralized error logger.
 *
 * Every catch block in the codebase should call `logError(err, ctx)`.
 * Writes go to the `error_logs` Supabase table (service role key, bypasses
 * RLS) and are visible in /admin/errors.
 *
 * This function NEVER throws. If the Supabase insert fails, we fall back
 * to `console.error` so Vercel runtime still has the signal. A broken
 * logger must not break the caller.
 */

export type LogLevel = "error" | "warn" | "info";
export type LogSource = "api-route" | "lib" | "client" | "webhook";

export interface LogContext {
  /** Route path or function name, e.g. "/api/square/pay" or "lib/loyalty.ts:accruePoints". Required. */
  path: string;
  /** Defaults to "lib". */
  source?: LogSource;
  /** Defaults to "error". */
  level?: LogLevel;
  /** Supabase user id if the error happened inside an authed request. */
  userId?: string;
  /** Correlation id — populate once request-id middleware exists. */
  requestId?: string;
  /** Arbitrary structured data to help debugging: inputs, entity ids, flags, etc. */
  context?: Record<string, unknown>;
}

let _serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient | null {
  if (_serviceClient) return _serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // Can't write to Supabase; caller will still get a console.error.
    return null;
  }

  _serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serviceClient;
}

function normalize(err: unknown): { message: string; stack: string | null } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack ?? null };
  }
  if (typeof err === "string") {
    return { message: err, stack: null };
  }
  try {
    return { message: JSON.stringify(err, bigintReplacer), stack: null };
  } catch {
    return { message: String(err), stack: null };
  }
}

/**
 * JSON.stringify replacer that coerces BigInt to string. Defense-in-depth
 * against any caller that forgets to sanitize before passing a Square SDK
 * value into the error context. The global shim in instrumentation.ts
 * handles most cases; this catches anything that slips through.
 */
function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

function sanitizeContext(ctx: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!ctx) return null;
  try {
    // Round-trip through JSON with the BigInt replacer. Expensive but
    // happens only on the error path, and keeps the row insert-safe.
    return JSON.parse(JSON.stringify(ctx, bigintReplacer));
  } catch {
    return { _unserializable: true };
  }
}

/**
 * Write an error to the admin error log. Fire-and-forget friendly —
 * returns a resolved Promise even on failure.
 */
export async function logError(err: unknown, ctx: LogContext): Promise<void> {
  const { message, stack } = normalize(err);
  const level: LogLevel = ctx.level ?? "error";
  const source: LogSource = ctx.source ?? "lib";

  // Always write to console so Vercel runtime still shows it.
  const prefix = `[${level}] [${source}] ${ctx.path}`;
  if (level === "error") {
    console.error(prefix, message, ctx.context ?? "");
  } else if (level === "warn") {
    console.warn(prefix, message, ctx.context ?? "");
  } else {
    console.info(prefix, message, ctx.context ?? "");
  }

  const supabase = getServiceClient();
  if (!supabase) return;

  try {
    const { error } = await supabase.from("error_logs").insert({
      level,
      source,
      path: ctx.path,
      message,
      stack,
      context: sanitizeContext(ctx.context),
      user_id: ctx.userId ?? null,
      request_id: ctx.requestId ?? null,
    });

    if (error) {
      // Don't throw — just log.
      console.error("[log-error] Supabase insert failed:", error.message);
    }
  } catch (insertErr) {
    console.error(
      "[log-error] Unexpected failure while logging:",
      insertErr instanceof Error ? insertErr.message : insertErr,
    );
  }
}
