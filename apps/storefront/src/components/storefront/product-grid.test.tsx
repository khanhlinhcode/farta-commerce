import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Product } from "@/lib/catalog";
import { ProductGrid } from "./product-grid";

vi.mock("./product-card", () => ({
  ProductCard: ({
    product,
    priority,
  }: {
    product: Product;
    priority?: boolean;
  }) => <span data-eager={String(Boolean(priority))}>{product.name}</span>,
}));

const products = [
  { id: "one", name: "One" },
  { id: "two", name: "Two" },
] as Product[];

describe("ProductGrid image priority", () => {
  afterEach(cleanup);

  it("eager-loads only the first card when the grid owns the LCP candidate", () => {
    render(<ProductGrid products={products} eagerFirst />);

    expect(screen.getByText("One")).toHaveAttribute("data-eager", "true");
    expect(screen.getByText("Two")).toHaveAttribute("data-eager", "false");
  });

  it("keeps below-the-fold grids lazy by default", () => {
    render(<ProductGrid products={products} />);

    expect(screen.getByText("One")).toHaveAttribute("data-eager", "false");
    expect(screen.getByText("Two")).toHaveAttribute("data-eager", "false");
  });
});
