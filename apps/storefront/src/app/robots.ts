import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const indexable =
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_INDEXABLE === "true";
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/account", "/search"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
