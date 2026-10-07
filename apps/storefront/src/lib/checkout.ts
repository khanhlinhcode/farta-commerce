import type {
  CheckoutPreview,
  GuestOrderLookupReadModel,
  OrderReadModel,
  OrderSummaryReadModel,
} from "@farta/types";

import { apiRequest, customerCsrfHeaders } from "./api-client";

export type CheckoutInput = {
  recipientName: string;
  phone: string;
  addressLine: string;
  provinceCity: string;
  district?: string;
  ward?: string;
  shippingMethod: "STANDARD";
  paymentMethod: "COD";
  notes?: string;
  quoteToken: string;
};

export function getCheckoutPreview(): Promise<CheckoutPreview> {
  return apiRequest<CheckoutPreview>("/checkout/preview", {
    method: "POST",
    headers: { "content-type": "application/json", ...customerCsrfHeaders() },
    body: "{}",
  });
}

export function submitCheckout(
  input: CheckoutInput,
  idempotencyKey: string,
): Promise<OrderReadModel> {
  return apiRequest<OrderReadModel>("/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      ...customerCsrfHeaders(),
    },
    body: JSON.stringify(input),
  });
}

export function getOrder(orderCode: string): Promise<OrderReadModel> {
  return apiRequest<OrderReadModel>(`/orders/${encodeURIComponent(orderCode)}`);
}

export function getCustomerOrders(): Promise<{
  items: OrderSummaryReadModel[];
}> {
  return apiRequest<{ items: OrderSummaryReadModel[] }>("/orders?limit=20");
}

export function lookupOrder(orderCode: string, phone: string) {
  return apiRequest<GuestOrderLookupReadModel>("/orders/lookup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderCode, phone }),
  });
}
