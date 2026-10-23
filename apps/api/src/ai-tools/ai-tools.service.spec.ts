import { describe, expect, it, vi } from "vitest";

import type { ProductsService } from "../products/products.service";
import { AiToolsService } from "./ai-tools.service";

const product = {
  id: "507f1f77bcf86cd799439011",
  slug: "farta-essential-tee",
  name: "FARTA Essential Tee",
  shortDescription: "Áo thun cotton.",
  description: "Mô tả công khai.",
  categoryIds: [],
  categories: [],
  coverMedia: {
    id: "507f1f77bcf86cd799439013",
    secureUrl: "https://res.cloudinary.com/demo/image/upload/tee.jpg",
    width: 1200,
    height: 1500,
    altText: "FARTA Essential Tee",
  },
  media: [],
  tags: [],
  price: { currency: "VND" as const, min: 399_000, max: 399_000 },
  variants: [
    {
      id: "507f1f77bcf86cd799439012",
      sku: "INTERNAL-SKU",
      color: "Đen",
      colorCode: "#171717",
      size: "M",
      price: 399_000,
      compareAtPrice: null,
      currency: "VND" as const,
      media: [],
      availability: "IN_STOCK" as const,
    },
  ],
  seo: { title: null, description: null },
};

describe("AiToolsService", () => {
  it("maps public product data without internal SKU or exact stock", async () => {
    const products = {
      listPublic: vi.fn().mockResolvedValue({
        items: [product],
        page: 1,
        limit: 6,
        total: 1,
      }),
      getPublicBySlug: vi.fn().mockResolvedValue(product),
    } as unknown as ProductsService;
    const service = new AiToolsService(products);
    const result = await service.search({ limit: 6 });

    expect(result.tool).toBe("search_products");
    expect(result.products[0]).toMatchObject({
      slug: "farta-essential-tee",
      priceVnd: 399_000,
      availability: "IN_STOCK",
    });
    expect(result.products[0]).not.toHaveProperty("sku");
    expect(result.products[0]).not.toHaveProperty("onHand");
    expect(products.listPublic).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 6, page: 1, sort: "newest" }),
    );
  });

  it("narrows authoritative availability by color and size", async () => {
    const products = {
      getPublicBySlug: vi.fn().mockResolvedValue(product),
    } as unknown as ProductsService;
    const service = new AiToolsService(products);
    const result = await service.availability({
      slug: product.slug,
      color: "Đen",
      size: "M",
    });
    expect(result.products[0]?.variants).toHaveLength(1);
    expect(result.products[0]?.variants[0]?.availability).toBe("IN_STOCK");
  });

  it("does not reinterpret a missing exact variant as out of stock", async () => {
    const products = {
      getPublicBySlug: vi.fn().mockResolvedValue(product),
    } as unknown as ProductsService;
    const service = new AiToolsService(products);
    const result = await service.availability({
      slug: product.slug,
      color: "Kem",
      size: "L",
    });

    expect(result.products).toEqual([]);
    expect(result.availabilityResolution).toEqual({
      status: "NOT_FOUND",
      productSlug: product.slug,
      color: "kem",
      size: "l",
      availability: null,
    });
  });

  it("fails closed when more than one variant matches the requested dimensions", async () => {
    const duplicateDimensionProduct = {
      ...product,
      variants: [
        product.variants[0],
        {
          ...product.variants[0],
          id: "507f1f77bcf86cd799439099",
          sku: "SECOND-INTERNAL-SKU",
          availability: "OUT_OF_STOCK" as const,
        },
      ],
    };
    const products = {
      getPublicBySlug: vi.fn().mockResolvedValue(duplicateDimensionProduct),
    } as unknown as ProductsService;
    const service = new AiToolsService(products);
    const result = await service.availability({
      slug: product.slug,
      color: "Đen",
      size: "M",
    });

    expect(result.products).toEqual([]);
    expect(result.availabilityResolution).toEqual({
      status: "AMBIGUOUS",
      productSlug: product.slug,
      color: "đen",
      size: "m",
      availability: null,
    });
  });

  it("uses one exact variant instead of the product aggregate", async () => {
    const exactVariantProduct = {
      ...product,
      variants: [
        {
          ...product.variants[0],
          availability: "OUT_OF_STOCK" as const,
        },
        {
          ...product.variants[0],
          id: "507f1f77bcf86cd799439098",
          sku: "CREAM-L",
          color: "Kem",
          size: "L",
          availability: "IN_STOCK" as const,
        },
      ],
    };
    const products = {
      getPublicBySlug: vi.fn().mockResolvedValue(exactVariantProduct),
    } as unknown as ProductsService;
    const service = new AiToolsService(products);
    const result = await service.availability({
      slug: product.slug,
      color: "  Đen  ",
      size: " size  M ",
    });

    expect(result.products[0]?.availability).toBe("OUT_OF_STOCK");
    expect(result.products[0]?.variants).toHaveLength(1);
    expect(result.availabilityResolution).toEqual({
      status: "MATCHED",
      productSlug: product.slug,
      color: "đen",
      size: "m",
      availability: "OUT_OF_STOCK",
    });
  });
});
