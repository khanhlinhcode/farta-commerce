import type { NextConfig } from "next";

const apiTarget =
  process.env.API_INTERNAL_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:4000"
    : undefined);
const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const isDevelopment = process.env.NODE_ENV === "development";
const cloudinarySource = cloudName ? " https://res.cloudinary.com" : "";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https://vietqr.app${cloudinarySource}`,
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@farta/ui", "@farta/types"],
  images: {
    maximumRedirects: 0,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vietqr.app",
        port: "",
        pathname: "/img",
      },
      ...(cloudName
        ? [
            {
              protocol: "https",
              hostname: "res.cloudinary.com",
              port: "",
              pathname: `/${cloudName}/**`,
            },
          ]
        : []),
    ],
  },
  async rewrites() {
    if (!apiTarget) return [];
    return [{ source: "/api/:path*", destination: `${apiTarget}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(isDevelopment
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
