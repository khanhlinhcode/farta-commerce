import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductVariant } from "@/lib/catalog";
import { VariantSelector } from "./variant-selector";

const variant = (
  id: string,
  color: string,
  size: string,
  availability: ProductVariant["availability"] = "IN_STOCK",
): ProductVariant => ({
  id,
  sku: `FAR-${id}`,
  color,
  colorCode: null,
  size,
  price: 199_000,
  compareAtPrice: null,
  currency: "VND",
  media: [],
  availability,
});

describe("VariantSelector", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function renderSelector(children: ReactNode) {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    return render(
      <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    );
  }

  it("only presents combinations that exist for the selected color", () => {
    const { container } = renderSelector(
      <VariantSelector
        variants={[
          variant("black-s", "Black", "S"),
          variant("black-l", "Black", "L"),
          variant("cream-s", "Cream", "S"),
          variant("cream-m", "Cream", "M", "OUT_OF_STOCK"),
        ]}
      />,
    );

    const colorButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".choice-row button"),
    );
    fireEvent.click(
      colorButtons.find((button) => button.textContent?.includes("Cream"))!,
    );
    const sizeButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".size-row button"),
    );
    expect(sizeButtons.map((button) => button.textContent)).toEqual(["S", "M"]);
    expect(sizeButtons[0]).toBeEnabled();
    expect(sizeButtons[1]).toBeDisabled();
  });

  it("sends the real selected variant to the authoritative cart API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "cart-id",
          status: "ACTIVE",
          currency: "VND",
          version: 1,
          itemCount: 1,
          subtotal: 199000,
          total: 199000,
          expiresAt: new Date().toISOString(),
          conflicts: [],
          items: [],
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    const { getByRole } = renderSelector(
      <VariantSelector
        variants={[
          variant("black-s", "Black", "S"),
          variant("cream-m", "Cream", "M"),
        ]}
      />,
    );
    fireEvent.click(getByRole("button", { name: /Cream/ }));
    fireEvent.click(getByRole("button", { name: "Thêm vào giỏ" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/cart/items",
      expect.objectContaining({
        body: JSON.stringify({ variantId: "cream-m", quantity: 1 }),
      }),
    );
  });
});
