import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductVariant } from "@/lib/catalog";
import { VariantSelector } from "./variant-selector";

const variant = (
  id: string,
  color: string,
  size: string,
  availability: ProductVariant["availability"] = "IN_STOCK",
  price = 199_000,
): ProductVariant => ({
  id,
  sku: `FAR-${id}`,
  color,
  colorCode: null,
  size,
  price,
  compareAtPrice: null,
  currency: "VND",
  media: [],
  availability,
});

function ControlledSelector({ variants }: { variants: ProductVariant[] }) {
  const initial =
    variants.find((item) => item.availability !== "OUT_OF_STOCK") ??
    variants[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");

  return (
    <VariantSelector
      variants={variants}
      selectedVariant={variants.find((item) => item.id === selectedId)}
      onVariantChange={(item) => setSelectedId(item.id)}
    />
  );
}

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
      <ControlledSelector
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
      <ControlledSelector
        variants={[
          variant("black-s", "Black", "S"),
          variant("cream-m", "Cream", "M"),
        ]}
      />,
    );
    fireEvent.click(getByRole("button", { name: /Cream/ }));
    fireEvent.click(getByRole("button", { name: "Thêm vào giỏ" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/cart",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/cart/items",
      expect.objectContaining({
        body: JSON.stringify({ variantId: "cream-m", quantity: 1 }),
      }),
    );
  });

  it("waits for guest Cart hydration before the first mutation", async () => {
    let resolveHydration: ((response: Response) => void) | undefined;
    const hydration = new Promise<Response>((resolve) => {
      resolveHydration = resolve;
    });
    const cart = {
      id: "cart-id",
      status: "ACTIVE",
      currency: "VND",
      version: 0,
      itemCount: 0,
      subtotal: 0,
      total: 0,
      expiresAt: new Date().toISOString(),
      conflicts: [],
      items: [],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => hydration)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...cart, version: 1, itemCount: 1 }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );

    const { getByRole } = renderSelector(
      <ControlledSelector variants={[variant("black-s", "Black", "S")]} />,
    );
    fireEvent.click(getByRole("button", { name: "Thêm vào giỏ" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/cart",
      expect.objectContaining({ credentials: "include" }),
    );

    resolveHydration?.(
      new Response(JSON.stringify(cart), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/cart/items",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("keeps price and availability aligned with the selected variant", () => {
    const { getByRole, getByText } = renderSelector(
      <ControlledSelector
        variants={[
          variant("black-s", "Black", "S", "IN_STOCK", 199_000),
          variant("cream-m", "Cream", "M", "LOW_STOCK", 229_000),
        ]}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Cream" }));

    expect(getByText(/229\.000/)).toBeInTheDocument();
    expect(getByText("Sắp hết")).toBeInTheDocument();
    expect(getByRole("button", { name: "M" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
