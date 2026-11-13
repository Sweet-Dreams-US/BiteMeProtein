import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// { slug: release_on } for every post file in content/blog, written into the
// build for proxy.ts (the blog release gate). Posts are only ever added by a
// commit, so the build always knows them; the date check itself runs on every
// request.
function blogReleaseDates(): string {
  const dir = path.join(process.cwd(), "content", "blog");
  const out: Record<string, string> = {};
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return "{}";
  }
  for (const file of files) {
    try {
      const text = readFileSync(path.join(dir, file), "utf8").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
      const fm = text.match(/^---\n([\s\S]*?)\n---/);
      if (!fm) continue;
      const slug = fm[1].match(/^slug:[ \t]*(.+?)[ \t]*$/m)?.[1]?.replace(/^["']|["']$/g, "");
      const release = fm[1].match(/^release_on:[ \t]*(\d{4}-\d{2}-\d{2})[ \t]*$/m)?.[1];
      if (slug && release && !(slug in out)) out[slug] = release;
    } catch {
      // an unreadable file simply never releases
    }
  }
  return JSON.stringify(out);
}

const nextConfig: NextConfig = {
  // Prevent Turbopack from bundling square — let it run as native Node.js
  // so it can access process.env at runtime
  serverExternalPackages: ["square"],
  // Blog posts are markdown files read from disk when a page renders (that is
  // how a post appears on its release date without a deploy). The root layout
  // checks for released posts on every page, so ship content/blog with every
  // server function.
  outputFileTracingIncludes: {
    "/*": ["./content/blog/**/*"],
  },
  env: {
    BLOG_RELEASE_DATES: blogReleaseDates(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jsfxfqjikxzexokjxtby.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "items-images-production.s3.us-west-2.amazonaws.com",
        pathname: "/**",
      },
    ],
  },
  // Immutable caching for the hero loop video + poster. Vercel's default
  // for /public files is `public, max-age=0, must-revalidate`, which
  // forces a conditional GET each visit. Pinning to one-year immutable
  // means returning visitors pay zero bytes. If a file ever changes,
  // rename it so caches bust naturally.
  //
  // The boomerang files were generated from the original clip with:
  //   ffmpeg -i src.mp4 -filter_complex "[0:v]scale=1920:-2,split[a][b];
  //     [b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];
  //     [a][r]concat=n=2:v=1[v]" -map "[v]" -an -c:v libx264 -preset slow
  //     -crf 27 -pix_fmt yuv420p -movflags +faststart biteme-hero-loop.mp4
  // (720p variant: scale=1280:-2, -crf 28.)
  async headers() {
    return ["/biteme-hero-loop.mp4", "/biteme-hero-loop-720.mp4", "/biteme-hero-poster.jpg"].map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    }));
  },
};

export default nextConfig;
