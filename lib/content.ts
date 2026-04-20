"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * useContent<T>(key, fallback)
 *
 * Subscribes to a key in public.cms_content and returns its value. Returns
 * `fallback` synchronously on first render (no flicker, no loading state
 * required on the consumer side), then re-renders with the DB value on
 * arrival. If the DB row doesn't exist or the fetch fails, `fallback` stays.
 *
 * Content is non-sensitive public site copy — RLS policy allows anonymous
 * reads — so we fetch directly from the client with no API round-trip.
 */
export function useContent<T>(key: string, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("cms_content")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data && data.value !== undefined && data.value !== null) {
        setValue(data.value as T);
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  return value;
}

/**
 * useContentBatch — fetch many keys in one round-trip.
 * Returns a map of key → value (fallback per key). Useful for a page that
 * needs several strings at once.
 */
export function useContentBatch<T extends Record<string, unknown>>(
  fallbacks: T,
): T {
  const [values, setValues] = useState<T>(fallbacks);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const keys = Object.keys(fallbacks);
      if (keys.length === 0) return;
      const { data, error } = await supabase
        .from("cms_content")
        .select("key, value")
        .in("key", keys);
      if (cancelled || error || !data) return;
      const next = { ...fallbacks };
      for (const row of data) {
        if (row.value !== undefined && row.value !== null) {
          (next as Record<string, unknown>)[row.key] = row.value;
        }
      }
      setValues(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(Object.keys(fallbacks))]);

  return values;
}
