import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Media, ProductVariant } from "@/lib/catalog";
import { ProductExperience } from "./product-experience";

vi.mock("./media-frame", () => ({
  MediaFrame: ({
    media,
    fallbackLabel,
  }: {
    media: Media | null;
    fallbackLabel: string;
  }) => (
    <span role="img" aria-label={media?.altText ?? fallbackLabel}>
      {media?.id ?? "missing"}
    </span>
  ),
}));

const blackMedia: Media = {
  id: "black-media",
  secureUrl: "https://res.cloudinary.com/test/image/upload/black.png",
  width: 1122,
  height: 1402,
  altText: "Áo thun màu đen",
};

const creamMedia: Media = {
  id: "cream-media",
  secureUrl: "https://res.cloudinary.com/test/image/upload/cream.png",
  width: 1122,
  height: 1402,
  altText: "Áo thun màu kem",
};

function variant(
  id: string,
  color: string,
  size: string,
  media: Media[],
): ProductVariant {
  return {
    id,
    sku: `FAR-${id}`,
    color,
    colorCode: color === "Kem" ? "#E8E0D1" : "#171717",
    size,
    price: color === "Kem" ? 229_000 : 199_000,
    compareAtPrice: null,
    currency: "VND",
    media,
    availability: color === "Kem" ? "LOW_STOCK" : "IN_STOCK",
  };
}

function renderExperience(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  );
}

describe("ProductExperience", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("moves selected variant media to the primary gallery position", () => {
    const { container, getByRole } = renderExperience(
      <ProductExperience
        name="FARTA Essential Tee"
        shortDescription="Áo thun phom relaxed."
        description="Mô tả sản phẩm."
        media={[blackMedia, creamMedia]}
        variants={[
          variant("black-s", "Đen", "S", [blackMedia]),
          variant("cream-m", "Kem", "M", [creamMedia]),
        ]}
      />,
    );

    expect(
      container.querySelector(".product-gallery__primary [role='img']"),
    ).toHaveAccessibleName("Áo thun màu đen");

    fireEvent.click(getByRole("button", { name: /^Kem$/ }));

    expect(
      container.querySelector(".product-gallery__primary [role='img']"),
    ).toHaveAccessibleName("Áo thun màu kem");
    expect(getByRole("button", { name: "M" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("falls back to product media and clears stale Cart feedback", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            id: "cart-id",
            status: "ACTIVE",
            currency: "VND",
            version: 1,
            itemCount: 1,
            subtotal: 199_000,
            total: 199_000,
            expiresAt: new Date().toISOString(),
            conflicts: [],
            items: [],
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
    );
    const { container, getByRole, getByText, queryByText } = renderExperience(
      <ProductExperience
        name="FARTA Essential Tee"
        shortDescription={null}
        description={null}
        media={[blackMedia]}
        variants={[
          variant("black-s", "Đen", "S", []),
          variant("cream-m", "Kem", "M", []),
        ]}
      />,
    );

    expect(
      container.querySelector(".product-gallery__primary [role='img']"),
    ).toHaveAccessibleName("Áo thun màu đen");

    fireEvent.click(getByRole("button", { name: "Thêm vào giỏ" }));
    await waitFor(() =>
      expect(
        getByText("Đã thêm lựa chọn này vào giỏ hàng."),
      ).toBeInTheDocument(),
    );

    fireEvent.click(getByRole("button", { name: /^Kem$/ }));
    expect(
      queryByText("Đã thêm lựa chọn này vào giỏ hàng."),
    ).not.toBeInTheDocument();
  });
});
