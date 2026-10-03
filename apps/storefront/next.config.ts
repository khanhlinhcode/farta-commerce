import type { NextConfig } from "next";

const apiTarget = process.env.API_INTERNAL_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@farta/ui", "@farta/types"],
  async rewrites() {
    if (!apiTarget) return [];
    return [{ source: "/api/:path*", destination: `${apiTarget}/api/:path*` }];
  },
};

export default nextConfig;
