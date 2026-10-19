import type { AiProductReference } from "@farta/types";

import { AiProductCard } from "./ai-product-card";

export function AiProductResults({
  products,
  onNavigate,
}: {
  products: readonly AiProductReference[];
  onNavigate: () => void;
}) {
  if (!products.length) return null;
  return (
    <div className="ai-product-results" aria-label="Sản phẩm từ hệ thống FARTA">
      {products.map((product) => (
        <AiProductCard
          key={product.id}
          product={product}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}
