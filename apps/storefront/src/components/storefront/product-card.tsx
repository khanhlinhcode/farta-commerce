import Link from "next/link";

import { formatVnd, type Product } from "@/lib/catalog";
import { MediaFrame } from "./media-frame";

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
  const compareAt = Math.max(
    0,
    ...product.variants.map((variant) => variant.compareAtPrice ?? 0),
  );
  const alternateMedia = product.media.find(
    (media) => media.id !== product.coverMedia?.id,
  );
  const isNew = product.tags.some((tag) => tag.toLowerCase() === "new");
  return (
    <article className="product-card">
      <Link
        href={`/product/${product.slug}`}
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
          />
        )}
        {(soldOut || isNew || compareAt > product.price.min) && (
          <span className="product-badge">
            {soldOut ? "Hết hàng" : isNew ? "Mới" : "Sale"}
          </span>
        )}
      </Link>
      <div className="product-card__info">
        <div>
          <h3>
            <Link href={`/product/${product.slug}`}>{product.name}</Link>
          </h3>
          <p>{formatVnd(product.price.min)}</p>
        </div>
        {compareAt > product.price.min && <del>{formatVnd(compareAt)}</del>}
      </div>
      {colors.length > 0 && (
        <div className="color-row" aria-label={`${colors.length} màu`}>
          {colors.slice(0, 5).map((variant) => (
            <span
              key={variant.color}
              title={variant.color}
              style={{ backgroundColor: variant.colorCode ?? "#d8d2c7" }}
            />
          ))}
        </div>
      )}
    </article>
  );
}
