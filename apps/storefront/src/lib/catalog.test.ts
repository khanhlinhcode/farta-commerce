import { describe, expect, it } from "vitest";

import {
  formatVnd,
  parseCatalogQuery,
  primaryCategorySlug,
  type Product,
} from "./catalog";

describe("catalog URL boundary", () => {
  it("allowlists supported scalar filters and bounds pagination", () => {
    expect(
      parseCatalogQuery({
        q: "  áo khoác  ",
        category: ["women", "$ne"],
        minPrice: "199000",
        availability: "IN_STOCK",
        page: "2",
        operator: "$where",
      }),
    ).toEqual({
      q: "áo khoác",
      minPrice: 199000,
      availability: "IN_STOCK",
      sort: "newest",
      page: 2,
      limit: 24,
    });
  });

  it("rejects invalid numeric and enum values", () => {
    expect(
      parseCatalogQuery({
        minPrice: "-1",
        maxPrice: "Infinity",
        availability: "$ne",
        page: "100000000",
      }),
    ).toEqual({ sort: "newest", page: 1, limit: 24 });
  });

  it("formats integer VND without floating-point calculation", () => {
    expect(formatVnd(199_000)).toContain("199.000");
  });

  it("uses the public category slug for related-product queries", () => {
    expect(
      primaryCategorySlug({
        categoryIds: ["507f1f77bcf86cd799439011"],
        categories: [
          {
            id: "507f1f77bcf86cd799439011",
            slug: "ao-thun-nu",
            name: "Áo thun nữ",
          },
        ],
      } as Product),
    ).toBe("ao-thun-nu");
  });

  it("keeps the PDP available while an older cached product omits categories", () => {
    expect(
      primaryCategorySlug({
        categoryIds: ["507f1f77bcf86cd799439011"],
      } as Product),
    ).toBeUndefined();
  });
});
