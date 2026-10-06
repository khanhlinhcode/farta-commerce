import type { CartReadModel } from "@farta/types";

import { apiRequest, customerCsrfHeaders } from "./api-client";

export const cartQueryKey = ["cart"] as const;

export function getCart(): Promise<CartReadModel> {
  return apiRequest<CartReadModel>("/cart");
}

export function addCartItem(variantId: string, quantity = 1) {
  return apiRequest<CartReadModel>("/cart/items", {
    method: "POST",
    headers: { "content-type": "application/json", ...customerCsrfHeaders() },
    body: JSON.stringify({ variantId, quantity }),
  });
}

export function updateCartItem(itemId: string, quantity: number) {
  return apiRequest<CartReadModel>(`/cart/items/${itemId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...customerCsrfHeaders() },
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(itemId: string) {
  return apiRequest<CartReadModel>(`/cart/items/${itemId}`, {
    method: "DELETE",
    headers: customerCsrfHeaders(),
  });
}

export function clearCart() {
  return apiRequest<CartReadModel>("/cart", {
    method: "DELETE",
    headers: customerCsrfHeaders(),
  });
}

export function mergeCart(csrfToken: string) {
  return apiRequest<CartReadModel>("/cart/merge", {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
  });
}
