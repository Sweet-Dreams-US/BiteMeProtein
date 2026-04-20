import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazy Supabase client.
 *
 * We used to eagerly `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...)`
 * at module load, which crashed Vercel Preview builds whose env scope didn't
 * include the public vars — the `!` assertion lied, `createClient` got
 * `undefined`, and any page statically-prerendered by Next would fail with
 * "supabaseUrl is required."
 *
 * Now we expose the same `supabase` symbol via a Proxy. The real client is
 * built on first property access, which never happens during build-time
 * prerender (client components don't run effects server-side). Runtime
 * behavior is identical; the build just doesn't care whether env is set.
 */

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example)",
    );
  }

  _client = createClient(url, key);
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
