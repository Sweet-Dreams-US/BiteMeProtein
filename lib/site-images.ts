"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface SiteImage {
  key: string;
  url: string;
  alt: string | null;
}

/**
 * useSiteImage(key, fallbackUrl?) — returns the current URL for a non-product
 * image by key (hero, logos, about photos, collection shots). Falls back to
 * fallbackUrl if set, or empty string otherwise.
 */
export function useSiteImage(key: string, fallbackUrl?: string): string {
  const [url, setUrl] = useState<string>(fallbackUrl ?? "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("site_images")
        .select("url")
        .eq("key", key)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data?.url) setUrl(data.url);
    })();
    return () => { cancelled = true; };
  }, [key]);

  return url;
}

/**
 * Batch fetch. Pass a fallback map; returns same shape filled with DB URLs
 * where available.
 */
export function useSiteImages(fallbacks: Record<string, string>): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>(fallbacks);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const keys = Object.keys(fallbacks);
      if (keys.length === 0) return;
      const { data, error } = await supabase
        .from("site_images")
        .select("key, url")
        .in("key", keys);
      if (cancelled || error || !data) return;
      const next = { ...fallbacks };
      for (const row of data) {
        if (row.url) next[row.key] = row.url;
      }
      setUrls(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(Object.keys(fallbacks))]);

  return urls;
}
