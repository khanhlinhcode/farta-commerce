import { describe, expect, it, vi } from "vitest";

import type { PaginatedProducts, Product } from "@/lib/catalog";
import { collectSitemapProducts, sitemapDataPolicy } from "./sitemap";

function product(index: number): Product {
  return {
    id: `product-${index}`,
    slug: `product-${index}`,
    name: `Product ${index}`,
    shortDescription: null,
    description: null,
    categoryIds: [],
    categories: [],
    coverMedia: null,
    media: [],
    tags: [],
    price: { currency: "VND", min: 100_000, max: 100_000 },
    variants: [],
    seo: { title: null, description: null },
  };
}

describe("sitemap product pagination", () => {
  it("collects and deduplicates more than 100 public products", async () => {
    const fetchPage = vi.fn(async ({ page }: { page: number }) => {
      const items =
        page === 1
          ? Array.from({ length: 100 }, (_, index) => product(index))
          : [product(100), product(0)];
      return {
        ok: true as const,
        data: {
          items,
          page,
          limit: 100,
          total: 101,
        } satisfies PaginatedProducts,
      };
    });
    const result = await collectSitemapProducts(fetchPage);
    expect(result).toHaveLength(101);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("returns deterministic partial data if a later page is unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await collectSitemapProducts(async ({ page }) =>
      page === 1
        ? {
            ok: true,
            data: { items: [product(1)], page: 1, limit: 1, total: 2 },
          }
        : { ok: false, error: "UNAVAILABLE" },
    );
    expect(result.map((item) => item.slug)).toEqual(["product-1"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("fails closed when deployment sitemap data is required", async () => {
    const fetchPage = vi.fn(async () => ({
      ok: false as const,
      error: "UNAVAILABLE" as const,
    }));
    await expect(collectSitemapProducts(fetchPage, "required")).rejects.toThrow(
      "SITEMAP_PRODUCTS_UNAVAILABLE_PAGE_1",
    );
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("recovers one transient build-time catalog failure in required mode", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "UNAVAILABLE" })
      .mockResolvedValueOnce({
        ok: true,
        data: { items: [product(1)], page: 1, limit: 100, total: 1 },
      });

    await expect(
      collectSitemapProducts(fetchPage, "required"),
    ).resolves.toEqual([product(1)]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("requires authoritative data for indexable deployments", () => {
    expect(sitemapDataPolicy({ NEXT_PUBLIC_INDEXABLE: "true" })).toBe(
      "required",
    );
    expect(sitemapDataPolicy({ NEXT_PUBLIC_INDEXABLE: "false" })).toBe(
      "optional",
    );
    expect(() => sitemapDataPolicy({ SITEMAP_DATA_POLICY: "unknown" })).toThrow(
      "INVALID_SITEMAP_DATA_POLICY",
    );
  });
});
