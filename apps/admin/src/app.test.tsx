import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./app";

describe("admin authentication boundary", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  it("renders the real staff login without a hardcoded admin session", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/login"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Đăng nhập FARTA Admin" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autocomplete",
      "username",
    );
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
  });

  it("renders server-backed order operations from the feature route", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/v1/auth/staff/me")) {
        return new Response(
          JSON.stringify({
            user: {
              id: "staff-1",
              email: "owner@farta.test",
              displayName: "FARTA Owner",
              roles: ["OWNER"],
              permissions: ["order.read", "order.update", "order.cancel"],
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/v1/admin/orders")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "order-1",
                orderCode: "FAR-20261008-ABCDEFGHJK",
                customerId: null,
                recipientName: "Linh To",
                phone: "+84912345678",
                status: "CONFIRMED",
                paymentStatus: "FULLY_PAID",
                paymentMethod: "FULL",
                currency: "VND",
                itemCount: 1,
                total: 329000,
                createdAt: "2026-10-08T00:00:00.000Z",
                updatedAt: "2026-10-08T00:00:00.000Z",
              },
            ],
            page: 1,
            limit: 20,
            total: 1,
            pages: 1,
          }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/orders"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Đơn hàng" }),
    ).toBeInTheDocument();
    const orderLink = await screen.findByRole("link", {
      name: "FAR-20261008-ABCDEFGHJK",
    });
    expect(orderLink).toHaveAttribute(
      "href",
      "/orders/FAR-20261008-ABCDEFGHJK",
    );
    expect(
      within(orderLink.closest("tr")!).getByText("FULLY_PAID"),
    ).toBeVisible();
  });
});
