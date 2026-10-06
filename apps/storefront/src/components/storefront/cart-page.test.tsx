import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CartPage } from "./cart-page";

function renderCart() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CartPage />
    </QueryClientProvider>,
  );
}

describe("CartPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows an intentional loading state", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>(() => undefined),
    );
    renderCart();
    expect(screen.getByText("Đang chuẩn bị giỏ hàng…")).toBeInTheDocument();
  });

  it("shows the premium empty state from an authoritative empty cart", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "cart-id",
          status: "ACTIVE",
          currency: "VND",
          version: 0,
          itemCount: 0,
          subtotal: 0,
          total: 0,
          expiresAt: new Date().toISOString(),
          conflicts: [],
          items: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    renderCart();
    expect(
      await screen.findByRole("heading", {
        name: "Giỏ hàng đang đợi một lựa chọn thật đúng.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Tiếp tục mua sắm" }),
    ).toHaveAttribute("href", "/shop");
  });

  it("shows a recoverable network error state", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    renderCart();
    expect(
      await screen.findByRole("heading", { name: "Chưa thể mở giỏ hàng" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeEnabled();
  });
});
