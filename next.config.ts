import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly pass server-side env vars so they're available in API routes
  serverExternalPackages: ["square"],
  env: {
    SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN,
    SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
    SQUARE_APPLICATION_ID: process.env.SQUARE_APPLICATION_ID,
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT,
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
};

export default nextConfig;
