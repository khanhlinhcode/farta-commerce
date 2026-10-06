import { describe, expect, it } from "vitest";

import { formatVnd, parseCatalogQuery } from "./catalog";

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
});
