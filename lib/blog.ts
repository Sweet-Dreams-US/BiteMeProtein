import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Blog posts are markdown files in content/blog (YYYY-MM-DD-slug.md). The
 * contract for those files is the BLOG-FORMAT rules kept by Sweet Dreams.
 * Nothing is baked into the build: pages read the files when they render and
 * revalidate every hour, so a post appears on its release date with no
 * deploy. A post is visible on and after its `release_on` date, counted in
 * Fort Wayne time. Before that it has no page, and it is left out of the
 * index, the sitemap, the feed and the nav link.
 */

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const TIME_ZONE = "America/Indiana/Indianapolis";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "https://bitemeprotein.com";

export interface BlogSource {
  title: string;
  author?: string;
  url: string;
}

export interface BlogPost {
  post_id: string;
  seq: number;
  title: string;
  slug: string;
  /** YYYY-MM-DD, compared as a plain string with today's Fort Wayne date. */
  release_on: string;
  description: string;
  reading_minutes: number;
  /** Public path of the cover image, or null. */
  cover_image: string | null;
  sources: BlogSource[];
  /** Markdown after the front matter, exactly as stored. */
  body: string;
}

/** Today's date in Fort Wayne time, as YYYY-MM-DD. */
export function todayInFortWayne(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isReleased(post: Pick<BlogPost, "release_on">, today: string = todayInFortWayne()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(post.release_on) && post.release_on <= today;
}

export function formatReleaseDate(releaseOn: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${releaseOn}T00:00:00Z`));
}

/* ------------------------------------------------------------ front matter */

type FrontMatter = Record<string, string | Record<string, string>[]>;

function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Reads the fixed front matter shape from the blog format: plain `key: value`
 * lines, plus `sources` as a list of title, author and url entries.
 */
function parseFrontMatter(raw: string): FrontMatter {
  const lines = raw.split("\n");
  const result: FrontMatter = {};
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const [, key, rest] = m;
    if (rest.trim() !== "") {
      result[key] = unquote(rest);
      i++;
      continue;
    }
    const items: Record<string, string>[] = [];
    let j = i + 1;
    while (j < lines.length && (/^\s+-\s/.test(lines[j]) || /^\s+-\s*$/.test(lines[j]) || /^-\s/.test(lines[j]))) {
      const item: Record<string, string> = {};
      const first = lines[j].match(/^\s*-\s*([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/);
      if (first) item[first[1]] = unquote(first[2]);
      j++;
      while (j < lines.length && /^\s+[A-Za-z_]/.test(lines[j]) && !/^\s*-\s/.test(lines[j])) {
        const kv = lines[j].match(/^\s*([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/);
        if (kv) item[kv[1]] = unquote(kv[2]);
        j++;
      }
      items.push(item);
    }
    result[key] = items;
    i = j > i + 1 ? j : i + 1;
  }
  return result;
}

function coverUrl(slug: string, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const rel = v.replace(/^\.?\/+/, "").replace(/^images\//, "");
  // Relative covers live in content/blog/images/<slug>/ and are served by /blog/images.
  return `/blog/images/${rel.includes("/") ? rel : `${slug}/${rel}`}`;
}

function wordCount(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

function parsePost(filename: string, source: string): BlogPost | null {
  const raw = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const match = raw.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n([\s\S]*))?$/);
  if (!match) {
    console.error(`[blog] ${filename}: no front matter, skipped`);
    return null;
  }
  const fm = parseFrontMatter(match[1]);
  const str = (k: string) => (typeof fm[k] === "string" ? (fm[k] as string).trim() : "");

  const post_id = str("post_id");
  const title = str("title");
  const slug = str("slug");
  if (!post_id || !title || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    console.error(`[blog] ${filename}: missing post_id, title or a valid slug, skipped`);
    return null;
  }

  const body = (match[2] ?? "").trim();
  const sourcesRaw = fm.sources;
  const sources: BlogSource[] = Array.isArray(sourcesRaw)
    ? sourcesRaw
        .filter((s) => s.title && s.url)
        .map((s) => ({ title: s.title, author: s.author || undefined, url: s.url }))
    : [];

  return {
    post_id,
    seq: Number(str("seq")) || 0,
    title,
    slug,
    release_on: str("release_on"),
    description: str("description"),
    reading_minutes: Math.max(1, Number(str("reading_minutes")) || Math.round(wordCount(body) / 220)),
    cover_image: coverUrl(slug, str("cover_image")),
    sources,
    body,
  };
}

async function readAllPosts(): Promise<BlogPost[]> {
  let files: string[];
  try {
    files = (await readdir(BLOG_DIR)).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }
  const parsed = await Promise.all(
    files.map(async (file) => {
      try {
        return parsePost(file, await readFile(path.join(BLOG_DIR, file), "utf8"));
      } catch (err) {
        console.error(`[blog] ${file}: could not be read`, err);
        return null;
      }
    }),
  );

  // One entry per post_id and per slug, first file name (earliest date) wins.
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  const posts: BlogPost[] = [];
  for (const p of parsed.filter((x): x is BlogPost => x !== null)) {
    if (seenIds.has(p.post_id) || seenSlugs.has(p.slug)) continue;
    seenIds.add(p.post_id);
    seenSlugs.add(p.slug);
    posts.push(p);
  }
  return posts;
}

/** Released posts only, newest first. Same-day posts show the later one first. */
export async function getReleasedPosts(): Promise<BlogPost[]> {
  const today = todayInFortWayne();
  const posts = (await readAllPosts()).filter((p) => isReleased(p, today));
  return posts.sort((a, b) => {
    if (a.release_on !== b.release_on) return a.release_on < b.release_on ? 1 : -1;
    return b.seq - a.seq;
  });
}

/** A post the pages may show, or null (a 404) when it is missing or not yet due. */
export async function getReleasedPost(slug: string): Promise<BlogPost | null> {
  return (await getReleasedPosts()).find((p) => p.slug === slug) ?? null;
}

/** True once at least one post has released. Decides whether the nav shows Blog. */
export async function hasReleasedPosts(): Promise<boolean> {
  try {
    return (await getReleasedPosts()).length > 0;
  } catch {
    return false;
  }
}
