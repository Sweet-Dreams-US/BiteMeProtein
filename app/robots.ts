import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "https://bitemeprotein.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep these out of search-engine indexes. They're either behind
        // auth (admin, account), not intended for direct indexing (api,
        // callbacks), or transient (order confirmation, track links with
        // query params that expose order IDs).
        disallow: [
          "/admin",
          "/admin/*",
          "/api/*",
          "/account",
          "/account/*",
          "/order-confirmation",
          "/track",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
