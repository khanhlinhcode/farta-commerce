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
const SITEMAP_REQUIRED_ATTEMPTS = 2;
export type SitemapDataPolicy = "optional" | "required";

export function sitemapDataPolicy(
  environment: Record<string, string | undefined> = process.env,
): SitemapDataPolicy {
  const configured = environment.SITEMAP_DATA_POLICY;
  if (configured === "optional" || configured === "required") {
    return configured;
  }
  if (configured !== undefined) {
    throw new Error("INVALID_SITEMAP_DATA_POLICY");
  }
  return environment.NEXT_PUBLIC_INDEXABLE === "true" ? "required" : "optional";
}

export async function loadSitemapData<T>(
  fetchData: () => Promise<CatalogResult<T>>,
  policy: SitemapDataPolicy,
): Promise<CatalogResult<T>> {
  const attempts = policy === "required" ? SITEMAP_REQUIRED_ATTEMPTS : 1;
  let result: CatalogResult<T> = { ok: false, error: "UNAVAILABLE" };

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    result = await fetchData();
    if (result.ok) return result;
  }

  return result;
}

export async function collectSitemapProducts(
  fetchPage: (input: {
    page: number;
    limit: number;
    sort: "newest";
  }) => Promise<CatalogResult<PaginatedProducts>> = getProducts,
  policy: SitemapDataPolicy = "optional",
): Promise<Product[]> {
  const products = new Map<string, Product>();
  for (let page = 1; page <= SITEMAP_MAX_PAGES; page += 1) {
    const result = await loadSitemapData(
      () =>
        fetchPage({
          page,
          limit: SITEMAP_PAGE_SIZE,
          sort: "newest",
        }),
      policy,
    );
    if (!result.ok) {
      if (policy === "required") {
        throw new Error(`SITEMAP_PRODUCTS_UNAVAILABLE_PAGE_${page}`);
      }
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
  const policy = sitemapDataPolicy();
  const [categories, products] = await Promise.all([
    loadSitemapData(() => getCategories("build"), policy),
    collectSitemapProducts((input) => getProducts(input, "build"), policy),
  ]);
  if (!categories.ok && policy === "required") {
    throw new Error("SITEMAP_CATEGORIES_UNAVAILABLE");
  }
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
