import type { MetadataRoute } from "next";

import { getCategories, getProducts } from "@/lib/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ limit: 100, sort: "newest" }),
  ]);
  const staticRoutes = ["", "/shop", "/new-arrivals", "/collections"].map(
    (path) => ({ url: `${base}${path}`, changeFrequency: "daily" as const }),
  );
  const categoryRoutes = categories.ok
    ? categories.data.items.flatMap((category) => [
        {
          url: `${base}/category/${category.slug}`,
          changeFrequency: "weekly" as const,
        },
        {
          url: `${base}/collections/${category.slug}`,
          changeFrequency: "weekly" as const,
        },
      ])
    : [];
  const productRoutes = products.ok
    ? products.data.items.map((product) => ({
        url: `${base}/product/${product.slug}`,
        changeFrequency: "daily" as const,
      }))
    : [];
  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
