import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiChatWidget } from "./ai-chat-widget";

const mocks = vi.hoisted(() => ({
  pathname: "/shop",
  sendAiMessage: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/lib/ai-client", () => ({ sendAiMessage: mocks.sendAiMessage }));

describe("AiChatWidget", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    });
    mocks.pathname = "/shop";
    mocks.sendAiMessage.mockReset();
  });

  afterEach(cleanup);

  it("does not cover transactional routes", () => {
    mocks.pathname = "/checkout";
    render(<AiChatWidget />);
    expect(
      screen.queryByRole("button", { name: "Mở FARTA Product Advisor" }),
    ).not.toBeInTheDocument();
  });

  it("sends a suggested public-product query and renders the safe response", async () => {
    mocks.sendAiMessage.mockResolvedValue({
      requestId: "request-123",
      conversationId: "00000000-0000-4000-8000-000000000001",
      status: "completed",
      route: "deterministic",
      message: "FARTA tìm thấy 1 sản phẩm phù hợp.",
      products: [],
      citations: [],
      error: null,
    });
    render(<AiChatWidget />);
    fireEvent.click(
      screen.getByRole("button", { name: "Mở FARTA Product Advisor" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Tìm áo màu đen size M" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("FARTA tìm thấy 1 sản phẩm phù hợp."),
      ).toBeVisible(),
    );
    expect(mocks.sendAiMessage).toHaveBeenCalledWith({
      message: "Tìm áo màu đen size M",
      conversationId: null,
    });
  });
});
