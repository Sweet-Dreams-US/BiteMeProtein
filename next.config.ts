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
