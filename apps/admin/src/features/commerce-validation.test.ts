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
      }).success,
    ).toBe(false);
    expect(
      categorySchema.safeParse({
        name: "Áo nữ",
        status: "ACTIVE",
        parentCategoryId: "",
      }).success,
    ).toBe(true);
  });

  it("requires a product name and category", () => {
    expect(
      productSchema.safeParse({
        name: "Essential Tee",
        categoryId: "",
        coverMediaId: "",
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
      }).success,
    ).toBe(false);
    expect(
      variantSchema.safeParse({
        sku: "FAR-TEE-BLK-M",
        color: "Black",
        size: "M",
        price: 299_000,
        compareAtPrice: 199_000,
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
      bannerSchema.safeParse({ title: "", desktopMediaId: "" }).success,
    ).toBe(false);
  });

  it("does not offer invalid backward order transitions", () => {
    expect(allowedOrderTransitions("DELIVERED")).toEqual(["COMPLETED"]);
    expect(allowedOrderTransitions("COMPLETED")).toEqual([]);
    expect(allowedOrderTransitions("CANCELLED")).toEqual([]);
  });
});
