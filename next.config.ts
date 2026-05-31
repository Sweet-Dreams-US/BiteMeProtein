import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Turbopack from bundling square — let it run as native Node.js
  // so it can access process.env at runtime
  serverExternalPackages: ["square"],
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
  // Immutable caching for the hero scroll-video. Vercel's default for
  // /public files is `public, max-age=0, must-revalidate` — better than
  // Supabase's no-cache but still forces a conditional GET each visit.
  // Pinning the video to one-year immutable means returning visitors
  // pay zero bytes for it. If the file ever changes, rename it
  // (biteme-hero-v2.mp4) so caches bust naturally.
  async headers() {
    return [
      {
        source: "/biteme-hero-v2.mp4",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
