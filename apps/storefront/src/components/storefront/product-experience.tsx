"use client";

import { useMemo, useState } from "react";

import type { Media, ProductVariant } from "@/lib/catalog";
import { ProductGallery } from "./product-gallery";
import { VariantSelector } from "./variant-selector";

type ProductExperienceProps = {
  name: string;
  shortDescription: string | null;
  description: string | null;
  media: Media[];
  variants: ProductVariant[];
};

function initialVariant(variants: ProductVariant[]) {
  return (
    variants.find((variant) => variant.availability !== "OUT_OF_STOCK") ??
    variants[0]
  );
}

function uniqueMedia(media: Media[]) {
  return [...new Map(media.map((item) => [item.id, item])).values()];
}

export function ProductExperience({
  name,
  shortDescription,
  description,
  media,
  variants,
}: ProductExperienceProps) {
  const firstVariant = initialVariant(variants);
  const [selectedVariantId, setSelectedVariantId] = useState(
    firstVariant?.id ?? "",
  );
  const selectedVariant =
    variants.find((variant) => variant.id === selectedVariantId) ??
    firstVariant;
  const galleryMedia = useMemo(
    () => uniqueMedia([...(selectedVariant?.media ?? []), ...media]),
    [media, selectedVariant],
  );

  return (
    <div className="product-detail">
      <ProductGallery
        key={selectedVariant?.id ?? "product-gallery"}
        name={name}
        media={galleryMedia}
      />
      <section className="product-detail__info">
        <h1>{name}</h1>
        {shortDescription && <p className="product-lede">{shortDescription}</p>}
        <VariantSelector
          variants={variants}
          selectedVariant={selectedVariant}
          onVariantChange={(variant) => setSelectedVariantId(variant.id)}
        />
        {description && (
          <div className="product-accordions">
            <details open>
              <summary>Mô tả sản phẩm</summary>
              <p>{description}</p>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}
