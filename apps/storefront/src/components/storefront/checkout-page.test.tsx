import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckoutPage } from "./checkout-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function renderCheckout() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CheckoutPage />
    </QueryClientProvider>,
  );
}

describe("CheckoutPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders an authoritative COD preview without claiming payment", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "item-id",
              quantity: 1,
              product: {
                id: "product-id",
                slug: "farta-checkout-tee",
                name: "FARTA Checkout Tee",
              },
              variant: {
                id: "variant-id",
                sku: "FAR-CHECKOUT-BLK-M",
                color: "Black",
                colorCode: "#111111",
                size: "M",
              },
              image: null,
              unitPrice: 299000,
              lineSubtotal: 299000,
              currency: "VND",
              availability: "IN_STOCK",
            },
          ],
          conflicts: [],
          currency: "VND",
          itemsSubtotal: 299000,
          shippingFee: 30000,
          total: 329000,
          supportedPaymentMethods: ["COD"],
          paymentAmounts: { COD: 329000 },
          reservationTtlSeconds: 900,
          quoteToken: "a".repeat(64),
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    renderCheckout();
    expect(
      await screen.findByRole("heading", { name: "Xác nhận lựa chọn." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Thanh toán khi nhận hàng (COD)")).toBeVisible();
    expect(
      screen.getByText("Chưa thu tiền. Thanh toán cho đơn vị giao hàng."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Đặt hàng COD/ })).toBeEnabled();
  });

  it("blocks submission when the authoritative preview has conflicts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          conflicts: [{ itemId: "item-id", code: "OUT_OF_STOCK" }],
          currency: "VND",
          itemsSubtotal: 0,
          shippingFee: 30000,
          total: 30000,
          supportedPaymentMethods: ["COD"],
          paymentAmounts: { COD: 30000 },
          reservationTtlSeconds: 900,
          quoteToken: "b".repeat(64),
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    renderCheckout();
    expect(
      await screen.findByText(
        "Giỏ hàng có sản phẩm cần kiểm tra lại trước khi đặt hàng.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Đặt hàng COD/ })).toBeDisabled();
  });
});
