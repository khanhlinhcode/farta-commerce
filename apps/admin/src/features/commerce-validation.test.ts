import { describe, expect, it } from "vitest";

import { bannerSchema } from "./banners/banner-schema";
import { categorySchema } from "./categories/category-schema";
import { inventoryAdjustmentSchema } from "./inventory/inventory-schema";
import { allowedOrderTransitions } from "./orders/order-state";
import { productSchema } from "./products/product-schema";
import { variantSchema } from "./variants/variant-schema";

describe("Admin commerce form contracts", () => {
  it("uses the same bounded category validation for create and update forms", () => {
    expect(
      categorySchema.safeParse({
        name: "   ",
        status: "ACTIVE",
        parentCategoryId: "",
        sortOrder: 0,
      }).success,
    ).toBe(false);
    expect(
      categorySchema.safeParse({
        name: "Áo nữ",
        status: "ACTIVE",
        parentCategoryId: "",
        sortOrder: 0,
      }).success,
    ).toBe(true);
  });

  it("requires a product name and category", () => {
    expect(
      productSchema.safeParse({
        name: "Essential Tee",
        categoryIds: [],
        coverMediaId: "",
        status: "DRAFT",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid variant prices and compare prices", () => {
    expect(
      variantSchema.safeParse({
        sku: "FAR-TEE-BLK-M",
        color: "Black",
        size: "M",
        price: 299_000.5,
        lowStockThreshold: 5,
      }).success,
    ).toBe(false);
    expect(
      variantSchema.safeParse({
        sku: "FAR-TEE-BLK-M",
        color: "Black",
        size: "M",
        price: 299_000,
        compareAtPrice: 199_000,
        lowStockThreshold: 5,
      }).success,
    ).toBe(false);
  });

  it("requires an explicit inventory adjustment reason", () => {
    expect(
      inventoryAdjustmentSchema.safeParse({ quantityDelta: 2, reason: "Sai" })
        .success,
    ).toBe(false);
    expect(
      inventoryAdjustmentSchema.safeParse({
        quantityDelta: 2,
        reason: "Nhập bổ sung từ kho chính",
      }).success,
    ).toBe(true);
  });

  it("requires banner title and media", () => {
    expect(
      bannerSchema.safeParse({
        ...validBanner,
        title: "",
        desktopMediaId: "",
      }).success,
    ).toBe(false);
  });

  it("rejects unsafe banner CTA and invalid schedules", () => {
    expect(
      bannerSchema.safeParse({
        ...validBanner,
        ctaTarget: "https://evil.example",
      }).success,
    ).toBe(false);
    expect(
      bannerSchema.safeParse({
        ...validBanner,
        startAt: "2026-10-17T12:00",
        endAt: "2026-10-17T11:00",
      }).success,
    ).toBe(false);
  });

  it("does not offer invalid backward order transitions", () => {
    expect(allowedOrderTransitions("DELIVERED")).toEqual(["COMPLETED"]);
    expect(allowedOrderTransitions("COMPLETED")).toEqual([]);
    expect(allowedOrderTransitions("CANCELLED")).toEqual([]);
  });
});

const validBanner = {
  title: "FARTA Atelier",
  desktopMediaId: "507f1f77bcf86cd799439011",
  position: "home-hero",
  priority: 0,
  status: "DRAFT" as const,
};
