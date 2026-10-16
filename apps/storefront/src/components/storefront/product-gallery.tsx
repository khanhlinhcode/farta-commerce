"use client";

import { useState } from "react";

import { MediaFrame } from "./media-frame";
import type { Media } from "@/lib/catalog";

export function ProductGallery({
  name,
  media,
}: {
  name: string;
  media: Media[];
}) {
  const frames = media.length > 0 ? media : [null];
  const [activeMediaId, setActiveMediaId] = useState(frames[0]?.id ?? "");
  const activeMedia =
    frames.find((item) => item?.id === activeMediaId) ?? frames[0] ?? null;

  return (
    <div className="product-gallery" aria-label={`Hình ảnh ${name}`}>
      <figure className="product-gallery__frame product-gallery__primary">
        <MediaFrame
          media={activeMedia}
          fallbackLabel={name}
          priority
          className="product-gallery__image"
          sizes="(max-width: 960px) calc(100vw - 32px), 58vw"
        />
        {frames.length > 1 && (
          <figcaption className="product-gallery__count" aria-hidden="true">
            {String(
              Math.max(
                0,
                frames.findIndex((item) => item?.id === activeMedia?.id),
              ) + 1,
            ).padStart(2, "0")}
            <span>/</span>
            {String(frames.length).padStart(2, "0")}
          </figcaption>
        )}
      </figure>
      {frames.length > 1 && (
        <div className="product-gallery__thumbnails" aria-label="Chọn hình ảnh">
          {frames.map((item) => (
            <button
              type="button"
              className={item?.id === activeMedia?.id ? "is-selected" : ""}
              aria-label={`Xem ${item?.altText ?? name}`}
              aria-pressed={item?.id === activeMedia?.id}
              key={item?.id ?? "empty"}
              onClick={() => setActiveMediaId(item?.id ?? "")}
            >
              <MediaFrame
                media={item}
                fallbackLabel={name}
                className="product-gallery__thumbnail-image"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
