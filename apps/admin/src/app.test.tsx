import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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

  it("shows the safe server error when staff login is rejected", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/v1/auth/staff/csrf")) {
        return new Response(JSON.stringify({ csrfToken: "test-csrf" }), {
          status: 200,
        });
      }
      if (url.endsWith("/api/v1/auth/staff/login")) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INVALID_CREDENTIALS",
              message: "Thông tin đăng nhập không hợp lệ.",
            },
          }),
          { status: 401 },
        );
      }
      return new Response(null, { status: 404 });
    });
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
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "staff@farta.test" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "not-the-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Thông tin đăng nhập không hợp lệ.",
    );
  });

  it("renders a permission-denied state instead of treating 403 as logout", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "FORBIDDEN", message: "Không đủ quyền." },
        }),
        { status: 403 },
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bạn không có quyền truy cập khu vực quản trị này.",
    );
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
