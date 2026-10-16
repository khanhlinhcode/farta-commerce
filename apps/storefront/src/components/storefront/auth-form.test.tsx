import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "./auth-form";

const mocks = vi.hoisted(() => ({
  mergeCart: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: React.ComponentProps<"a">) => (
    <a href={String(href)}>{children}</a>
  ),
}));
vi.mock("@/lib/cart", () => ({ mergeCart: mocks.mergeCart }));

function successfulAuthFetch() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ csrfToken: "csrf-before" }), {
        status: 200,
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ csrfToken: "csrf-after" }), {
        status: 201,
      }),
    );
}

function submitLogin() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "linh@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), {
    target: { value: "a secure password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
}

describe("AuthForm Cart merge boundary", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mocks.mergeCart.mockReset();
    mocks.push.mockReset();
    mocks.refresh.mockReset();
  });

  it("navigates normally after authentication and a successful merge", async () => {
    successfulAuthFetch();
    mocks.mergeCart.mockResolvedValue({});
    render(<AuthForm mode="login" />);
    submitLogin();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/account"));
    expect(mocks.mergeCart).toHaveBeenCalledWith("csrf-after");
  });

  it("keeps authentication successful when Cart merge is unavailable", async () => {
    const fetchMock = successfulAuthFetch();
    mocks.mergeCart.mockRejectedValue(new Error("network unavailable"));
    render(<AuthForm mode="login" />);
    submitLogin();
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/account?cart=review"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByText(/Dịch vụ đăng nhập đang tạm gián đoạn/),
    ).not.toBeInTheDocument();
  });
});
