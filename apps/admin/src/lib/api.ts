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
  description: string | null;
  imageMediaId: string | null;
  seo: { title: string | null; description: string | null };
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  status: string;
  categoryIds: string[];
  coverMediaId: string | null;
  mediaIds: string[];
  shortDescription: string | null;
  description: string | null;
  tags: string[];
  seo: { title: string | null; description: string | null };
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
  colorCode: string | null;
  mediaIds: string[];
  lowStockThreshold: number;
};

export type MediaAsset = {
  id: string;
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  bytes: number;
  resourceType: "image" | "video";
  format: string;
  durationSeconds: number | null;
  altText: string | null;
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  position: string;
  priority: number;
  status: string;
  ctaLabel: string | null;
  ctaTarget: string | null;
  startAt: string | null;
  endAt: string | null;
  desktopMedia: MediaAsset | null;
  mobileMedia: MediaAsset | null;
  desktopVideo: MediaAsset | null;
  mobileVideo: MediaAsset | null;
};

export type AdminOrderListItem = {
  id: string;
  orderCode: string;
  customerId: string | null;
  recipientName: string;
  phone: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  currency: "VND";
  itemCount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderDetail = AdminOrderListItem & {
  items: Array<{
    productName: string;
    sku: string;
    color: string;
    size: string;
    unitPrice: number;
    quantity: number;
    lineSubtotal: number;
  }>;
  shipping: {
    recipientName: string;
    phone: string;
    addressLine: string;
    provinceCity: string;
    district: string | null;
    ward: string | null;
    method: "STANDARD";
    notes: string | null;
  };
  itemsSubtotal: number;
  shippingFee: number;
  payment: {
    provider: string;
    method: string;
    status: string;
    expectedAmount: number;
    orderTotal: number;
    receivedAmount: number;
    transactionReference: string | null;
    reconciliationReference: string | null;
    reconciliationReason: string | null;
    reconciledBy: string | null;
    reconciledAt: string | null;
  } | null;
  timeline: Array<{
    status: string;
    at: string;
    actorType: string;
    actorId: string | null;
    requestId: string;
  }>;
  reservations: Array<{
    id: string;
    variantId: string;
    quantity: number;
    status: string;
    expiresAt: string;
    confirmedAt: string | null;
    releasedAt: string | null;
  }>;
  paymentEvents: Array<{
    id: string;
    provider: string;
    eventId: string;
    status: string;
    outcomeCode: string;
    replayMismatchCount: number;
    createdAt: string;
  }>;
  audit: Array<{
    id: string;
    action: string;
    actorId: string;
    requestId: string;
    reason: string | null;
    createdAt: string;
  }>;
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

function queryString(input: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
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
  categories: (
    query: {
      page?: number;
      limit?: number;
      q?: string;
      status?: string;
    } = {},
  ) =>
    api<{ items: Category[]; page: number; limit: number; total: number }>(
      `/admin/categories?${queryString({ limit: 20, ...query })}`,
    ),
  createCategory: (input: {
    name: string;
    status: string;
    parentCategoryId?: string;
    description?: string | null;
    imageMediaId?: string | null;
    sortOrder?: number;
  }) =>
    api<Category>("/admin/categories", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCategory: (
    categoryId: string,
    input: Partial<{
      name: string;
      status: string;
      parentCategoryId: string | null;
      description: string | null;
      imageMediaId: string | null;
      sortOrder: number;
    }>,
  ) =>
    api<Category>(`/admin/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  archiveCategory: (categoryId: string) =>
    api<void>(`/admin/categories/${categoryId}`, { method: "DELETE" }),
  products: (
    query: {
      page?: number;
      limit?: number;
      q?: string;
      status?: string;
      category?: string;
    } = {},
  ) =>
    api<{ items: Product[]; page: number; limit: number; total: number }>(
      `/admin/products?${queryString({ limit: 20, ...query })}`,
    ),
  product: (productId: string) => api<Product>(`/admin/products/${productId}`),
  createProduct: (input: {
    name: string;
    categoryIds: string[];
    coverMediaId?: string;
  }) =>
    api<Product>("/admin/products", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProduct: (
    productId: string,
    input: Partial<{
      name: string;
      slug: string;
      shortDescription: string | null;
      description: string | null;
      categoryIds: string[];
      status: string;
      tags: string[];
      coverMediaId: string | null;
      mediaIds: string[];
      seo: { title?: string | null; description?: string | null };
    }>,
  ) =>
    api<Product>(`/admin/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  archiveProduct: (productId: string) =>
    api<void>(`/admin/products/${productId}`, { method: "DELETE" }),
  variants: (productId: string) =>
    api<{ items: Variant[] }>(`/admin/products/${productId}/variants`),
  createVariant: (
    productId: string,
    input: {
      sku: string;
      color: string;
      colorCode?: string | null;
      size: string;
      price: number;
      compareAtPrice?: number | null;
      mediaIds?: string[];
      lowStockThreshold?: number;
    },
  ) =>
    api<Variant>(`/admin/products/${productId}/variants`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateVariant: (
    productId: string,
    variantId: string,
    input: Partial<{
      sku: string;
      color: string;
      colorCode: string | null;
      size: string;
      price: number;
      compareAtPrice: number | null;
      status: string;
      mediaIds: string[];
      lowStockThreshold: number;
    }>,
  ) =>
    api<Variant>(`/admin/products/${productId}/variants/${variantId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  archiveVariant: (productId: string, variantId: string) =>
    api<void>(`/admin/products/${productId}/variants/${variantId}`, {
      method: "DELETE",
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
  media: (
    query: {
      page?: number;
      limit?: number;
      resourceType?: "image" | "video";
    } = {},
  ) =>
    api<{
      items: MediaAsset[];
      page: number;
      limit: number;
      total: number;
    }>(`/admin/media?${queryString({ limit: 24, ...query })}`),
  archiveMedia: (mediaId: string) =>
    api<void>(`/admin/media/${mediaId}`, { method: "DELETE" }),
  async uploadMedia(
    file: File,
    altText: string,
    resourceType: "image" | "video",
  ) {
    const authorization = await api<{
      uploadUrl: string;
      apiKey: string;
      timestamp: number;
      publicId: string;
      signature: string;
      resourceType: "image" | "video";
      maxBytes: number;
      allowedFormats: readonly string[];
    }>("/admin/media/upload-authorizations", {
      method: "POST",
      body: JSON.stringify({ resourceType }),
    });
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
      resource_type: "image" | "video";
      format: string;
      width: number;
      height: number;
      bytes: number;
      version: number;
      signature: string;
      duration?: number;
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
        durationSeconds: result.duration,
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
    subtitle?: string | null;
    desktopMediaId: string;
    mobileMediaId?: string | null;
    desktopVideoMediaId?: string | null;
    mobileVideoMediaId?: string | null;
    position: string;
    ctaLabel?: string | null;
    ctaTarget?: string | null;
    priority?: number;
    startAt?: string | null;
    endAt?: string | null;
    status: string;
  }) =>
    api<Banner>("/admin/banners", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateBanner: (
    bannerId: string,
    input: Partial<{
      title: string;
      subtitle: string | null;
      desktopMediaId: string;
      mobileMediaId: string | null;
      desktopVideoMediaId: string | null;
      mobileVideoMediaId: string | null;
      ctaLabel: string | null;
      ctaTarget: string | null;
      position: string;
      priority: number;
      startAt: string | null;
      endAt: string | null;
      status: string;
    }>,
  ) =>
    api<Banner>(`/admin/banners/${bannerId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  archiveBanner: (bannerId: string) =>
    api<void>(`/admin/banners/${bannerId}`, { method: "DELETE" }),
  orders: (query: string) =>
    api<{
      items: AdminOrderListItem[];
      page: number;
      limit: number;
      total: number;
      pages: number;
    }>(`/admin/orders${query ? `?${query}` : ""}`),
  order: (orderCode: string) =>
    api<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(orderCode)}`),
  transitionOrder: (orderCode: string, status: string, reason: string) =>
    api<AdminOrderDetail>(
      `/admin/orders/${encodeURIComponent(orderCode)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      },
    ),
  cancelOrder: (orderCode: string, reason: string) =>
    api<AdminOrderDetail>(
      `/admin/orders/${encodeURIComponent(orderCode)}/cancel`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
  reconcilePayment: (
    orderCode: string,
    input: {
      action: "START_REFUND" | "CONFIRM_REFUNDED";
      reason: string;
      externalReference?: string;
    },
  ) =>
    api<{ orderCode: string; paymentStatus: string; orderStatus: string }>(
      `/admin/orders/${encodeURIComponent(orderCode)}/payment-reconciliation`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  collectCod: (orderCode: string, reason: string) =>
    api<{ orderCode: string; paymentStatus: string; orderStatus: string }>(
      `/admin/orders/${encodeURIComponent(orderCode)}/cod-collected`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
};
