"use client";

import { supabase } from "@/lib/supabase";

/**
 * Authenticated fetch wrapper for admin API routes.
 * Pulls the current Supabase session JWT and attaches it as a Bearer token.
 *
 * Use this in admin pages for any call to /api/square/* that requires auth
 * (catalog POST/PUT/DELETE, inventory POST, orders GET).
 */
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(init.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}
