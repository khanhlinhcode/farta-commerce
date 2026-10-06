export type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: ReadonlyArray<{ field: string; message: string }>;
  };
};

export type HealthStatus = {
  status: "ok" | "not_ready";
  requestId: string;
};

export type Realm = "CUSTOMER" | "STAFF";
export type Role = "CUSTOMER" | "STAFF" | "ADMIN" | "OWNER";

export type CartConflictCode =
  | "PRODUCT_UNAVAILABLE"
  | "VARIANT_UNAVAILABLE"
  | "OUT_OF_STOCK"
  | "QUANTITY_UNAVAILABLE"
  | "QUANTITY_LIMITED";

export type CartReadModel = {
  id: string;
  status: "ACTIVE" | "MERGED" | "CONVERTED" | "EXPIRED";
  currency: "VND";
  version: number;
  itemCount: number;
  subtotal: number;
  total: number;
  expiresAt: string;
  conflicts: ReadonlyArray<{ itemId: string; code: CartConflictCode }>;
  items: ReadonlyArray<{
    id: string;
    quantity: number;
    product: { id: string; slug: string; name: string } | null;
    variant: {
      id: string;
      sku: string;
      color: string;
      colorCode: string | null;
      size: string;
    };
    image: {
      id: string;
      secureUrl: string;
      width: number;
      height: number;
      altText: string | null;
    } | null;
    unitPrice: number;
    lineSubtotal: number;
    currency: "VND";
    availability: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  }>;
};
