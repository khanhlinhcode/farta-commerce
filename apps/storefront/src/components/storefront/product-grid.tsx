import type { Product } from "@/lib/catalog";
import { ProductCard } from "./product-card";

export function ProductGrid({
  products,
  eagerFirst = false,
}: {
  products: Product[];
  eagerFirst?: boolean;
}) {
  return (
    <div className="product-grid">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={eagerFirst && index === 0}
        />
      ))}
    </div>
  );
}
