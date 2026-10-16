import type { MetadataRoute } from "next";

import {
  getCategories,
  getProducts,
  type PaginatedProducts,
  type Product,
  type CatalogResult,
} from "@/lib/catalog";

const SITEMAP_PAGE_SIZE = 100;
const SITEMAP_MAX_PAGES = 100;

export async function collectSitemapProducts(
  fetchPage: (input: {
    page: number;
    limit: number;
    sort: "newest";
  }) => Promise<CatalogResult<PaginatedProducts>> = getProducts,
): Promise<Product[]> {
  const products = new Map<string, Product>();
  for (let page = 1; page <= SITEMAP_MAX_PAGES; page += 1) {
    const result = await fetchPage({
      page,
      limit: SITEMAP_PAGE_SIZE,
      sort: "newest",
    });
    if (!result.ok) {
      console.warn(`[sitemap] Product page ${page} was unavailable.`);
      break;
    }
    for (const product of result.data.items) {
      products.set(product.slug, product);
    }
    if (page * result.data.limit >= result.data.total) break;
  }
  return [...products.values()];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [categories, products] = await Promise.all([
    getCategories(),
    collectSitemapProducts(),
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
  const productRoutes = products.map((product) => ({
    url: `${base}/product/${product.slug}`,
    changeFrequency: "daily" as const,
  }));
  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
