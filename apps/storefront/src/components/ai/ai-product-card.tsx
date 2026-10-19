import type { AiProductReference } from "@farta/types";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function AiProductCard({
  product,
  onNavigate,
}: {
  product: AiProductReference;
  onNavigate: () => void;
}) {
  return (
    <article className="ai-product-card">
      <Link
        href={`/product/${product.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        onClick={onNavigate}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            width={320}
            height={400}
            sizes="(max-width: 640px) 42vw, 180px"
          />
        ) : (
          <span className="ai-product-card__fallback" aria-hidden="true" />
        )}
      </Link>
      <div>
        <p className="ai-product-card__availability">
          {product.availability === "OUT_OF_STOCK"
            ? "Hết hàng"
            : product.availability === "LOW_STOCK"
              ? "Sắp hết"
              : "Còn hàng"}
        </p>
        <h3>{product.name}</h3>
        <p>{currency.format(product.priceVnd)}</p>
        <Link
          href={`/product/${product.slug}`}
          className="ai-product-card__link"
          onClick={onNavigate}
        >
          Xem sản phẩm <ArrowUpRight aria-hidden="true" size={15} />
        </Link>
      </div>
    </article>
  );
}
