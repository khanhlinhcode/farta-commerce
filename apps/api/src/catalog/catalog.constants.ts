export const CATALOG_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
] as const;

export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

export const VARIANT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

export const AVAILABILITY_STATUSES = [
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const VND_CURRENCY = "VND" as const;
