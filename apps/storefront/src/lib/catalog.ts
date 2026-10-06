export type Media = {
  id: string;
  secureUrl: string;
  width: number;
  height: number;
  altText: string | null;
};

export type Availability = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type ProductVariant = {
  id: string;
  sku: string;
  color: string;
  colorCode: string | null;
  size: string;
  price: number;
  compareAtPrice: number | null;
  currency: "VND";
  media: Media[];
  availability: Availability;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  categoryIds: string[];
  coverMedia: Media | null;
  media: Media[];
  tags: string[];
  price: { currency: "VND"; min: number; max: number };
  variants: ProductVariant[];
  seo: { title: string | null; description: string | null };
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageMediaId: string | null;
  image: Media | null;
  parentCategoryId: string | null;
  status: string;
  sortOrder: number;
  seo: { title: string | null; description: string | null };
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  desktopMedia: Media | null;
  mobileMedia: Media | null;
  ctaLabel: string | null;
  ctaTarget: string | null;
  position: string;
  priority: number;
  startAt: string | null;
  endAt: string | null;
};

export type PaginatedProducts = {
  items: Product[];
  page: number;
  limit: number;
  total: number;
};

export type CatalogResult<T> =
  { ok: true; data: T } | { ok: false; error: "UNAVAILABLE" | "NOT_FOUND" };

export type CatalogQuery = {
  q?: string;
  category?: string;
  size?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: Availability;
  sort?: "newest";
  page?: number;
  limit?: number;
};

const apiBase = (
  process.env.API_INTERNAL_URL ?? "http://localhost:4000"
).replace(/\/$/, "");

async function publicRequest<T>(path: string): Promise<CatalogResult<T>> {
  try {
    const response = await fetch(`${apiBase}/api/v1${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 404) return { ok: false, error: "NOT_FOUND" };
    if (!response.ok) return { ok: false, error: "UNAVAILABLE" };
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}

export function getProducts(params: CatalogQuery = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return publicRequest<PaginatedProducts>(
    `/products${query.size ? `?${query}` : ""}`,
  );
}

function scalar(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function boundedInteger(
  value: string | string[] | undefined,
  minimum: number,
  maximum: number,
): number | undefined {
  const normalized = scalar(value);
  if (!normalized || !/^\d+$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : undefined;
}

/** Maps URL state to the explicit public Catalog API filter contract. */
export function parseCatalogQuery(
  input: Record<string, string | string[] | undefined>,
): CatalogQuery {
  const q = scalar(input.q)?.slice(0, 100);
  const category = scalar(input.category)?.slice(0, 120);
  const size = scalar(input.size)?.slice(0, 30);
  const color = scalar(input.color)?.slice(0, 80);
  const minPrice = boundedInteger(input.minPrice, 0, 1_000_000_000);
  const maxPrice = boundedInteger(input.maxPrice, 0, 1_000_000_000);
  const availabilityValue = scalar(input.availability);
  const availability = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"].includes(
    availabilityValue ?? "",
  )
    ? (availabilityValue as Availability)
    : undefined;
  const page = boundedInteger(input.page, 1, 10_000) ?? 1;

  return {
    ...(q ? { q } : {}),
    ...(category ? { category } : {}),
    ...(size ? { size } : {}),
    ...(color ? { color } : {}),
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice } : {}),
    ...(availability ? { availability } : {}),
    sort: "newest",
    page,
    limit: 24,
  };
}

export function getProduct(slug: string) {
  return publicRequest<Product>(`/products/${encodeURIComponent(slug)}`);
}

export function getCategories() {
  return publicRequest<{ items: Category[] }>("/categories");
}

export function getCategory(slug: string) {
  return publicRequest<Category>(`/categories/${encodeURIComponent(slug)}`);
}

export function getBanners(position = "home-hero") {
  return publicRequest<{ items: Banner[] }>(
    `/banners?position=${encodeURIComponent(position)}`,
  );
}

export function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function canOptimizeCloudinary(url: string): boolean {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.startsWith(`/${cloud}/`)
    );
  } catch {
    return false;
  }
}
