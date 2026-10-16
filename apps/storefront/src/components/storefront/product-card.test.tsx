import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Product } from "@/lib/catalog";
import { ProductCard, productCardPrice } from "./product-card";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./media-frame", () => ({
  MediaFrame: ({
    fallbackLabel,
    decorative,
  }: {
    fallbackLabel: string;
    decorative?: boolean;
  }) => <img alt={decorative ? "" : fallbackLabel} />,
}));

function product(variants: Product["variants"]): Product {
  const prices = variants.map((variant) => variant.price);
  return {
    id: "product-1",
    slug: "farta-tee",
    name: "FARTA Tee",
    shortDescription: null,
    description: null,
    categoryIds: ["category-1"],
    categories: [{ id: "category-1", slug: "tees", name: "Tees" }],
    coverMedia: {
      id: "cover",
      secureUrl: "https://example.test/cover.jpg",
      width: 1200,
      height: 1500,
      altText: "FARTA Tee",
    },
    media: [
      {
        id: "alternate",
        secureUrl: "https://example.test/alternate.jpg",
        width: 1200,
        height: 1500,
        altText: "FARTA Tee alternate",
      },
    ],
    tags: [],
    price: {
      currency: "VND",
      min: Math.min(...prices),
      max: Math.max(...prices),
    },
    variants,
    seo: { title: null, description: null },
  };
}

function variant(
  id: string,
  color: string,
  price: number,
  compareAtPrice: number | null,
): Product["variants"][number] {
  return {
    id,
    sku: id,
    color,
    colorCode: color === "Đen" ? "#111111" : "#eee4d2",
    size: "M",
    price,
    compareAtPrice,
    currency: "VND",
    media: [],
    availability: "IN_STOCK",
  };
}

describe("ProductCard", () => {
  afterEach(cleanup);

  it("renders a truthful range and does not cross compare prices between variants", () => {
    const item = product([
      variant("black", "Đen", 199_000, 249_000),
      variant("cream", "Kem", 229_000, null),
    ]);
    expect(productCardPrice(item)).toMatchObject({
      compareAt: null,
      onSale: true,
    });
    expect(productCardPrice(item).label).toContain("Từ");

    render(<ProductCard product={item} />);
    expect(screen.getByText("Sale")).toBeInTheDocument();
    expect(screen.getByText(/Màu có sẵn: Đen, Kem/)).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(document.querySelector('img[alt=""]')).toBeInTheDocument();
  });

  it("shows compare price only when every visible offer is unambiguous", () => {
    const item = product([
      variant("black-s", "Đen", 199_000, 249_000),
      variant("black-m", "Đen", 199_000, 249_000),
    ]);
    expect(productCardPrice(item).compareAt).toBe(249_000);
  });
});
