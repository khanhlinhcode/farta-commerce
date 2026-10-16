import Image from "next/image";

import { canOptimizeCloudinary, type Media } from "@/lib/catalog";

export function MediaFrame({
  media,
  fallbackLabel,
  priority = false,
  className = "",
  sizes = "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw",
}: {
  media: Media | null;
  fallbackLabel: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  if (!media || !canOptimizeCloudinary(media.secureUrl)) {
    return (
      <div
        className={`media-placeholder ${className}`}
        role="img"
        aria-label={`${fallbackLabel} — hình ảnh chưa được cấu hình`}
      >
        <span>FARTA</span>
      </div>
    );
  }
  return (
    <Image
      className={className}
      src={media.secureUrl}
      alt={media.altText ?? fallbackLabel}
      fill
      loading={priority ? "eager" : "lazy"}
      sizes={sizes}
    />
  );
}
