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

  return (
    <div className="product-gallery" aria-label={`Hình ảnh ${name}`}>
      {frames.map((item, index) => (
        <figure className="product-gallery__frame" key={item?.id ?? "empty"}>
          <MediaFrame
            media={item}
            fallbackLabel={name}
            priority={index === 0}
            className="product-gallery__image"
          />
        </figure>
      ))}
    </div>
  );
}
