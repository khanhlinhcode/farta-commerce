export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  status: string;
  sortOrder: number;
  parentCategoryId: string | null;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  status: string;
  categoryIds: string[];
  coverMediaId: string | null;
  updatedAt: string;
};

export type Variant = {
  id: string;
  sku: string;
  color: string;
  size: string;
  price: number;
  compareAtPrice: number | null;
  status: string;
};

export type MediaAsset = {
  id: string;
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  bytes: number;
  altText: string | null;
};

export type Banner = {
  id: string;
  title: string;
  position: string;
  priority: number;
  status: string;
  ctaTarget: string | null;
  desktopMedia: MediaAsset | null;
};

export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function cookie(name: string): string | undefined {
  return document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set("content-type", "application/json");
  if (init.method && !["GET", "HEAD"].includes(init.method.toUpperCase())) {
    const csrf =
      cookie("farta_staff_csrf") ?? cookie("__Secure-farta_staff_csrf");
    if (csrf) headers.set("x-csrf-token", decodeURIComponent(csrf));
  }
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiFailure(
      payload?.error?.code ?? `HTTP_${response.status}`,
      payload?.error?.message ?? "Yêu cầu không thành công.",
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const adminApi = {
  me: () => api<{ user: AdminUser }>("/auth/staff/me"),
  async login(email: string, password: string) {
    const csrf = await api<{ csrfToken: string }>("/auth/staff/csrf");
    return api<{ user: AdminUser }>("/auth/staff/login", {
      method: "POST",
      headers: { "x-csrf-token": csrf.csrfToken },
      body: JSON.stringify({ email, password }),
    });
  },
  logout: () => api<void>("/auth/staff/logout", { method: "POST" }),
  categories: () =>
    api<{ items: Category[]; total: number }>("/admin/categories?limit=100"),
  createCategory: (input: {
    name: string;
    status: string;
    parentCategoryId?: string;
  }) =>
    api<Category>("/admin/categories", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  products: () =>
    api<{ items: Product[]; total: number }>("/admin/products?limit=100"),
  createProduct: (input: {
    name: string;
    categoryIds: string[];
    coverMediaId?: string;
  }) =>
    api<Product>("/admin/products", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  variants: (productId: string) =>
    api<{ items: Variant[] }>(`/admin/products/${productId}/variants`),
  createVariant: (
    productId: string,
    input: { sku: string; color: string; size: string; price: number },
  ) =>
    api<Variant>(`/admin/products/${productId}/variants`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  inventory: (variantId: string) =>
    api<{
      onHand: number;
      reserved: number;
      available: number;
      lowStockThreshold: number;
    }>(`/admin/inventory/${variantId}`),
  adjustInventory: (
    variantId: string,
    input: { quantityDelta: number; reason: string },
  ) =>
    api<{ onHand: number; reserved: number; available: number }>(
      `/admin/inventory/${variantId}/adjustments`,
      {
        method: "PATCH",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify(input),
      },
    ),
  media: () => api<{ items: MediaAsset[] }>("/admin/media"),
  async uploadMedia(file: File, altText: string) {
    const authorization = await api<{
      uploadUrl: string;
      apiKey: string;
      timestamp: number;
      publicId: string;
      signature: string;
      maxBytes: number;
      allowedFormats: readonly string[];
    }>("/admin/media/upload-authorizations", { method: "POST" });
    if (file.size > authorization.maxBytes)
      throw new ApiFailure(
        "MEDIA_TOO_LARGE",
        "Tệp vượt quá giới hạn tải lên.",
        413,
      );
    const form = new FormData();
    form.set("file", file);
    form.set("api_key", authorization.apiKey);
    form.set("timestamp", String(authorization.timestamp));
    form.set("public_id", authorization.publicId);
    form.set("signature", authorization.signature);
    const upload = await fetch(authorization.uploadUrl, {
      method: "POST",
      body: form,
    });
    if (!upload.ok)
      throw new ApiFailure(
        "MEDIA_PROVIDER_FAILED",
        "Cloudinary không thể xử lý tệp.",
        upload.status,
      );
    const result = (await upload.json()) as {
      public_id: string;
      secure_url: string;
      resource_type: "image";
      format: string;
      width: number;
      height: number;
      bytes: number;
      version: number;
      signature: string;
    };
    return api<MediaAsset>("/admin/media/finalize", {
      method: "POST",
      body: JSON.stringify({
        publicId: result.public_id,
        secureUrl: result.secure_url,
        resourceType: result.resource_type,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        version: result.version,
        signature: result.signature,
        originalFilename: file.name,
        altText,
      }),
    });
  },
  banners: () => api<{ items: Banner[] }>("/admin/banners"),
  createBanner: (input: {
    title: string;
    desktopMediaId: string;
    position: string;
    ctaTarget?: string;
    status: string;
  }) =>
    api<Banner>("/admin/banners", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
