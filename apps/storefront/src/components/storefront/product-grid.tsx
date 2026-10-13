import type { Product } from "@/lib/catalog";
import { ProductCard } from "./product-card";

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="product-grid">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 4} />
      ))}
    </div>
  );
}
