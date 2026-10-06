import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
  it("only presents combinations that exist for the selected color", () => {
    const { container } = render(
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
});
