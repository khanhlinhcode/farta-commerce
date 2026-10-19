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

export type AiAvailability = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
export type AiRoute =
  "deterministic" | "agent" | "clarification" | "unsupported";
export type AiChatStatus = "completed" | "clarification" | "unavailable";

export type AiProductReference = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
  priceVnd: number;
  maxPriceVnd: number;
  availability: AiAvailability;
  variants: ReadonlyArray<{
    id: string;
    color: string;
    colorCode: string | null;
    size: string;
    priceVnd: number;
    compareAtPriceVnd: number | null;
    availability: AiAvailability;
  }>;
};

export type AiChatRequest = {
  message: string;
  conversationId?: string | null;
};

export type AiChatResponse = {
  requestId: string;
  conversationId: string;
  status: AiChatStatus;
  route: AiRoute;
  message: string;
  products: ReadonlyArray<AiProductReference>;
  citations: ReadonlyArray<never>;
  error: { code: string; message: string } | null;
};

export type AiToolName =
  "search_products" | "get_product_details" | "get_product_availability";

export type AiToolRequest = {
  tool: AiToolName;
  arguments: Record<string, unknown>;
};

export type AiToolResponse = {
  tool: AiToolName;
  products: ReadonlyArray<AiProductReference>;
};

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

export type CheckoutPreview = {
  items: CartReadModel["items"];
  conflicts: CartReadModel["conflicts"];
  currency: "VND";
  itemsSubtotal: number;
  shippingFee: number;
  total: number;
  supportedPaymentMethods: ReadonlyArray<"COD" | "DEPOSIT" | "FULL">;
  paymentAmounts: {
    COD: number;
    FULL?: number;
    DEPOSIT?: number;
  };
  reservationTtlSeconds: number;
  quoteToken: string;
};

export type OrderStatus =
  | "CREATED"
  | "CONFIRMED"
  | "PACKING"
  | "SHIPPING"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "PAYMENT_CONFLICT";

export const PAYMENT_STATUSES = [
  "UNPAID",
  "DEPOSIT_PAID",
  "FULLY_PAID",
  "FAILED",
  "EXPIRED",
  "REFUND_PENDING",
  "REFUNDED",
  "CONFLICT",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type OrderSummaryReadModel = {
  id: string;
  orderCode: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "COD" | "DEPOSIT" | "FULL";
  currency: "VND";
  itemCount: number;
  total: number;
  createdAt: string;
};

export type GuestOrderLookupReadModel = {
  orderCode: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "COD" | "DEPOSIT" | "FULL";
  currency: "VND";
  items: ReadonlyArray<{
    productName: string;
    color: string;
    size: string;
    quantity: number;
    lineSubtotal: number;
    image: {
      secureUrl: string;
      width: number;
      height: number;
      altText: string | null;
    } | null;
  }>;
  itemsSubtotal: number;
  shippingFee: number;
  total: number;
  timeline: ReadonlyArray<{ status: OrderStatus; at: string }>;
  createdAt: string;
};

export type OrderReadModel = {
  id: string;
  orderCode: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "COD" | "DEPOSIT" | "FULL";
  currency: "VND";
  items: ReadonlyArray<{
    productId: string;
    variantId: string;
    productName: string;
    sku: string;
    color: string;
    size: string;
    unitPrice: number;
    quantity: number;
    lineSubtotal: number;
    image: {
      secureUrl: string;
      width: number;
      height: number;
      altText: string | null;
    } | null;
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
  total: number;
  timeline: ReadonlyArray<{ status: OrderStatus; at: string }>;
  payment: {
    provider: "COD" | "SEPAY";
    method: "COD" | "DEPOSIT" | "FULL";
    status: PaymentStatus;
    amount: number;
    currency: "VND";
    codAmount: number;
    codCollectedAt: string | null;
    expectedAmount: number;
    orderTotal: number;
    receivedAmount: number;
    reference: string | null;
    expiresAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentInstructionsReadModel = {
  orderCode: string;
  status: PaymentStatus;
  receivedAmount: number;
  orderTotal: number;
  instructions: {
    provider: "SEPAY";
    method: "DEPOSIT" | "FULL";
    amount: number;
    currency: "VND";
    reference: string;
    expiresAt: string;
    bank: {
      name: string;
      accountNumber: string;
      accountHolder: string;
    };
    qrUrl: string;
  };
};

export type PaymentStatusReadModel = {
  orderCode: string;
  provider: "COD" | "SEPAY";
  method: "COD" | "DEPOSIT" | "FULL";
  status: PaymentStatus;
  currency: "VND";
  expectedAmount: number;
  receivedAmount: number;
  orderTotal: number;
  amountDue: number;
  reference: string | null;
  expiresAt: string | null;
  updatedAt: string;
};
