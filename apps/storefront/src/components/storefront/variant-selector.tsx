"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { addCartItem, cartQueryKey } from "@/lib/cart";
import { formatVnd, type ProductVariant } from "@/lib/catalog";

export function VariantSelector({ variants }: { variants: ProductVariant[] }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const colors = [
    ...new Map(variants.map((variant) => [variant.color, variant])).values(),
  ];
  const initialVariant =
    variants.find((variant) => variant.availability !== "OUT_OF_STOCK") ??
    variants[0];
  const [color, setColor] = useState(initialVariant?.color ?? "");
  const availableForColor = useMemo(
    () => variants.filter((variant) => variant.color === color),
    [color, variants],
  );
  const [size, setSize] = useState(initialVariant?.size ?? "");
  const selected =
    variants.find(
      (variant) => variant.color === color && variant.size === size,
    ) ?? availableForColor[0];
  const add = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("VARIANT_REQUIRED");
      return addCartItem(selected.id);
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

  function chooseColor(nextColor: string) {
    setColor(nextColor);
    const first =
      variants.find(
        (variant) =>
          variant.color === nextColor &&
          variant.availability !== "OUT_OF_STOCK",
      ) ?? variants.find((variant) => variant.color === nextColor);
    setSize(first?.size ?? "");
  }

  return (
    <div className="variant-selector">
      <div className="variant-price">
        <strong>{selected ? formatVnd(selected.price) : "Chưa có giá"}</strong>
        {selected?.compareAtPrice &&
        selected.compareAtPrice > selected.price ? (
          <del>{formatVnd(selected.compareAtPrice)}</del>
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
              />
              {variant.color}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Kích cỡ</legend>
        <div className="size-row">
          {availableForColor.map((variant) => (
            <button
              className={variant.size === size ? "is-selected" : ""}
              disabled={variant.availability === "OUT_OF_STOCK"}
              aria-pressed={variant.size === size}
              key={variant.id}
              onClick={() => setSize(variant.size)}
              type="button"
            >
              {variant.size}
            </button>
          ))}
        </div>
      </fieldset>
      <p
        className={`availability availability--${selected?.availability.toLowerCase() ?? "out_of_stock"}`}
      >
        {selected?.availability === "IN_STOCK"
          ? "Còn hàng"
          : selected?.availability === "LOW_STOCK"
            ? "Sắp hết"
            : "Tạm hết hàng"}
      </p>
      <button
        className="button button--primary button--wide"
        disabled={
          !selected || selected.availability === "OUT_OF_STOCK" || add.isPending
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
