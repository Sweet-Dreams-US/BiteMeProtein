import { SITE_URL, getReleasedPosts } from "@/lib/blog";

// Rebuilt at most once an hour, from released posts only.
export const revalidate = 3600;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await getReleasedPosts();

  const items = posts
    .map((p) => {
      const link = `${SITE_URL}/blog/${p.slug}`;
      return [
        "    <item>",
        `      <title>${esc(p.title)}</title>`,
        `      <link>${esc(link)}</link>`,
        `      <guid isPermaLink="true">${esc(link)}</guid>`,
        `      <pubDate>${new Date(`${p.release_on}T12:00:00Z`).toUTCString()}</pubDate>`,
        `      <description>${esc(p.description)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const newest = posts[0] ? `\n    <lastBuildDate>${new Date(`${posts[0].release_on}T12:00:00Z`).toUTCString()}</lastBuildDate>` : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Bite Me Protein Bakery Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Easy reads from Bite Me Protein Bakery about protein and food.</description>
    <language>en-us</language>${newest}
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
