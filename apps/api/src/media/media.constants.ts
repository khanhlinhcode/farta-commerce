export const MEDIA_RESOURCE_TYPES = ["image", "video"] as const;
export type MediaResourceType = (typeof MEDIA_RESOURCE_TYPES)[number];

export const MEDIA_FORMATS = {
  image: ["jpg", "jpeg", "png", "webp", "avif"],
  video: ["mp4", "webm"],
} as const satisfies Record<MediaResourceType, readonly string[]>;
