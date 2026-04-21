import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "https://bitemeprotein.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Public, indexable routes only. Admin + API + auth-gated routes are
  // excluded via robots.ts disallow rules; listing them here would be
  // contradictory.
  const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"] }> = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/shop", priority: 0.9, changeFrequency: "daily" },
    { path: "/rewards", priority: 0.8, changeFrequency: "weekly" },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" },
    { path: "/trainers", priority: 0.7, changeFrequency: "monthly" },
    { path: "/reviews", priority: 0.6, changeFrequency: "weekly" },
    { path: "/events", priority: 0.6, changeFrequency: "weekly" },
    { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
    { path: "/ambassador", priority: 0.5, changeFrequency: "monthly" },
    { path: "/quiz", priority: 0.5, changeFrequency: "monthly" },
    { path: "/compare", priority: 0.5, changeFrequency: "monthly" },
    { path: "/oven", priority: 0.4, changeFrequency: "monthly" },
    { path: "/new", priority: 0.4, changeFrequency: "weekly" },
    { path: "/careers", priority: 0.3, changeFrequency: "monthly" },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
