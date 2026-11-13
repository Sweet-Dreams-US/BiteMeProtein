import type { MetadataRoute } from "next";
import { getReleasedPosts } from "@/lib/blog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "https://bitemeprotein.com";

// Rebuilt at most once an hour so blog posts join the sitemap on their release date.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const posts = await getReleasedPosts();

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

  const pages = routes.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  // Blog pages are listed only for posts that have reached their release date.
  const blog: MetadataRoute.Sitemap = posts.length
    ? [
        {
          url: `${SITE_URL}/blog`,
          lastModified: new Date(`${posts[0].release_on}T12:00:00Z`),
          changeFrequency: "monthly",
          priority: 0.6,
        },
        ...posts.map((post) => ({
          url: `${SITE_URL}/blog/${post.slug}`,
          lastModified: new Date(`${post.release_on}T12:00:00Z`),
          changeFrequency: "yearly" as const,
          priority: 0.5,
        })),
      ]
    : [];

  return [...pages, ...blog];
}
