import Link from "next/link";

import { formatVnd, type Product } from "@/lib/catalog";
import { MediaFrame } from "./media-frame";

export function productCardPrice(product: Product): {
  label: string;
  compareAt: number | null;
  onSale: boolean;
} {
  const prices = product.variants.map((variant) => variant.price);
  const exactPrice = product.price.min === product.price.max;
  const comparePrices = product.variants.map(
    (variant) => variant.compareAtPrice,
  );
  const firstCompare = comparePrices[0] ?? null;
  const unambiguousCompare =
    exactPrice &&
    prices.every((price) => price === product.price.min) &&
    firstCompare !== null &&
    firstCompare > product.price.min &&
    comparePrices.every((price) => price === firstCompare);
  return {
    label: exactPrice
      ? formatVnd(product.price.min)
      : `Từ ${formatVnd(product.price.min)}`,
    compareAt: unambiguousCompare ? firstCompare : null,
    onSale: product.variants.some(
      (variant) =>
        variant.compareAtPrice !== null &&
        variant.compareAtPrice > variant.price,
    ),
  };
}

export function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const colors = [
    ...new Map(
      product.variants.map((variant) => [variant.color, variant]),
    ).values(),
  ];
  const soldOut = product.variants.every(
    (variant) => variant.availability === "OUT_OF_STOCK",
  );
  const pricing = productCardPrice(product);
  const alternateMedia = product.media.find(
    (media) => media.id !== product.coverMedia?.id,
  );
  const isNew = product.tags.some((tag) => tag.toLowerCase() === "new");
  return (
    <article className="product-card">
      <Link
        href={`/product/${product.slug}`}
        prefetch={false}
        className="product-card__image"
        aria-label={`Xem ${product.name}`}
      >
        <MediaFrame
          media={product.coverMedia}
          fallbackLabel={product.name}
          className="product-card__primary"
          priority={priority}
        />
        {alternateMedia && (
          <MediaFrame
            media={alternateMedia}
            fallbackLabel={`${product.name} — góc nhìn khác`}
            className="product-card__alternate"
            decorative
          />
        )}
        {(soldOut || isNew || pricing.onSale) && (
          <span className="product-badge">
            {soldOut ? "Hết hàng" : isNew ? "Mới" : "Sale"}
          </span>
        )}
      </Link>
      <div className="product-card__info">
        <div>
          <h3>
            <Link href={`/product/${product.slug}`} prefetch={false}>
              {product.name}
            </Link>
          </h3>
          <p>{pricing.label}</p>
        </div>
        {pricing.compareAt !== null && (
          <del>{formatVnd(pricing.compareAt)}</del>
        )}
      </div>
      {colors.length > 0 && (
        <div className="color-row">
          <span className="sr-only">
            Màu có sẵn: {colors.map((variant) => variant.color).join(", ")}
          </span>
          {colors.slice(0, 5).map((variant) => (
            <span
              key={variant.color}
              aria-hidden="true"
              title={variant.color}
              style={{ backgroundColor: variant.colorCode ?? "#d8d2c7" }}
            />
          ))}
        </div>
      )}
    </article>
  );
}
