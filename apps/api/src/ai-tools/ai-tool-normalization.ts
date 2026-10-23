export const normalizeCatalogDimension = (
  value: string | undefined,
): string | null => {
  if (value === undefined) return null;
  const normalized = value
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .trim()
    .replace(/\s+/g, " ");
  return normalized || null;
};

export const normalizeCatalogSize = (
  value: string | undefined,
): string | null => {
  const normalized = normalizeCatalogDimension(value);
  if (normalized === null) return null;
  const withoutPrefix = normalized.replace(/^size\s+/, "").trim();
  return withoutPrefix || null;
};
