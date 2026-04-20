import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for sync operations.
 *
 * Writes bypass RLS — that's the whole point: webhook + backfill + admin
 * sync-recent all run as service role so they can insert into RLS-locked
 * `square_*` tables. Never expose this client to browser-rendered code.
 *
 * Lazy singleton so build-time module evaluation doesn't crash if env
 * isn't set (matches lib/supabase.ts Proxy pattern).
 */

let _client: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Admin Supabase env missing: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (see .env.example)",
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
