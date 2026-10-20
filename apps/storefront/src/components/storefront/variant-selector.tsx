"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { addCartItem, cartQueryKey, getCart } from "@/lib/cart";
import { formatVnd, type ProductVariant } from "@/lib/catalog";

export function VariantSelector({
  variants,
  selectedVariant,
  onVariantChange,
}: {
  variants: ProductVariant[];
  selectedVariant: ProductVariant | undefined;
  onVariantChange: (variant: ProductVariant) => void;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const colors = [
    ...new Map(variants.map((variant) => [variant.color, variant])).values(),
  ];
  const color = selectedVariant?.color ?? "";
  const availableForColor = useMemo(
    () => variants.filter((variant) => variant.color === color),
    [color, variants],
  );
  const add = useMutation({
    mutationFn: async () => {
      if (!selectedVariant) throw new Error("VARIANT_REQUIRED");

      // The header hydrates the guest Cart on mount. Wait for that shared
      // query before mutating so two first requests cannot create competing
      // guest-cart cookies and let the slower response overwrite the winner.
      await queryClient.ensureQueryData({
        queryKey: cartQueryKey,
        queryFn: getCart,
        staleTime: 15_000,
      });
      return addCartItem(selectedVariant.id);
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(cartQueryKey, cart);
      setMessage("Đã thêm lựa chọn này vào giỏ hàng.");
    },
    onError: () => {
      setMessage(
        "Không thể thêm vào giỏ. Sản phẩm có thể vừa hết hàng, vui lòng thử lại.",
      );
    },
  });

  function selectVariant(variant: ProductVariant) {
    setMessage(null);
    add.reset();
    onVariantChange(variant);
  }

  function chooseColor(nextColor: string) {
    const first =
      variants.find(
        (variant) =>
          variant.color === nextColor &&
          variant.availability !== "OUT_OF_STOCK",
      ) ?? variants.find((variant) => variant.color === nextColor);
    if (first) selectVariant(first);
  }

  function chooseSize(nextSize: string) {
    const next = availableForColor.find((variant) => variant.size === nextSize);
    if (next) selectVariant(next);
  }

  return (
    <div className="variant-selector">
      <div className="variant-price">
        <strong>
          {selectedVariant ? formatVnd(selectedVariant.price) : "Chưa có giá"}
        </strong>
        {selectedVariant?.compareAtPrice &&
        selectedVariant.compareAtPrice > selectedVariant.price ? (
          <del>{formatVnd(selectedVariant.compareAtPrice)}</del>
        ) : null}
      </div>
      <fieldset>
        <legend>
          Màu sắc <span>{color}</span>
        </legend>
        <div className="choice-row">
          {colors.map((variant) => (
            <button
              className={variant.color === color ? "is-selected" : ""}
              aria-pressed={variant.color === color}
              key={variant.color}
              onClick={() => chooseColor(variant.color)}
              type="button"
            >
              <span
                className="color-swatch"
                style={{ backgroundColor: variant.colorCode ?? "#d8d2c7" }}
                aria-hidden="true"
              />
              {variant.color}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>
          Kích cỡ <span>{selectedVariant?.size ?? ""}</span>
        </legend>
        <div className="size-row">
          {availableForColor.map((variant) => (
            <button
              className={
                variant.id === selectedVariant?.id ? "is-selected" : ""
              }
              disabled={variant.availability === "OUT_OF_STOCK"}
              aria-pressed={variant.id === selectedVariant?.id}
              key={variant.id}
              onClick={() => chooseSize(variant.size)}
              type="button"
            >
              {variant.size}
            </button>
          ))}
        </div>
      </fieldset>
      <p
        className={`availability availability--${selectedVariant?.availability.toLowerCase() ?? "out_of_stock"}`}
        aria-live="polite"
      >
        {selectedVariant?.availability === "IN_STOCK"
          ? "Còn hàng"
          : selectedVariant?.availability === "LOW_STOCK"
            ? "Sắp hết"
            : "Tạm hết hàng"}
      </p>
      <button
        className="button button--primary button--wide"
        disabled={
          !selectedVariant ||
          selectedVariant.availability === "OUT_OF_STOCK" ||
          add.isPending
        }
        onClick={() => {
          setMessage(null);
          add.mutate();
        }}
        type="button"
      >
        {add.isPending ? "Đang thêm…" : "Thêm vào giỏ"}
      </button>
      {message && (
        <p
          className={add.isError ? "form-error" : "cart-feedback"}
          role="status"
        >
          {message} {add.isSuccess && <Link href="/cart">Xem giỏ</Link>}
        </p>
      )}
    </div>
  );
}
