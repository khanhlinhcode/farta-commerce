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
      route: "agent",
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
    expect(mocks.sendAiMessage).toHaveBeenCalledWith(
      {
        message: "Tìm áo màu đen size M",
        conversationId: null,
      },
      expect.any(AbortSignal),
    );
    expect(screen.getByText("Tư vấn AI · sản phẩm đã xác minh")).toBeVisible();
  });

  it("labels live generated advice and renders authoritative catalog results", async () => {
    mocks.sendAiMessage.mockResolvedValue({
      requestId: "request-123",
      conversationId: "00000000-0000-4000-8000-000000000001",
      status: "completed",
      route: "agent",
      message: "Một gợi ý phối đồ đã được xác minh theo catalog.",
      products: [],
      citations: [],
      error: null,
    });
    render(<AiChatWidget />);
    fireEvent.click(
      screen.getByRole("button", { name: "Mở FARTA Product Advisor" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Tìm sản phẩm màu kem" }),
    );
    expect(
      await screen.findByText("Tư vấn AI · sản phẩm đã xác minh"),
    ).toBeVisible();
  });

  it("offers one explicit retry control after a network failure", async () => {
    mocks.sendAiMessage
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce({
        requestId: "request-123",
        conversationId: "00000000-0000-4000-8000-000000000001",
        status: "clarification",
        route: "clarification",
        message: "Bạn muốn ưu tiên màu nào?",
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
    const retry = await screen.findByRole("button", {
      name: "Thử lại yêu cầu gần nhất",
    });
    fireEvent.click(retry);
    expect(await screen.findByText("Bạn muốn ưu tiên màu nào?")).toBeVisible();
    expect(mocks.sendAiMessage).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole("button", { name: "Thử lại yêu cầu gần nhất" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer a retry for a policy refusal", async () => {
    mocks.sendAiMessage.mockResolvedValue({
      requestId: "request-123",
      conversationId: "00000000-0000-4000-8000-000000000001",
      status: "unavailable",
      route: "unsupported",
      message: "Trợ lý chỉ hỗ trợ tư vấn sản phẩm công khai.",
      products: [],
      citations: [],
      error: {
        code: "AI_SCOPE_UNSUPPORTED",
        message: "Yêu cầu nằm ngoài phạm vi chỉ đọc.",
      },
    });
    render(<AiChatWidget />);
    fireEvent.click(
      screen.getByRole("button", { name: "Mở FARTA Product Advisor" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Tìm áo màu đen size M" }),
    );
    expect(
      await screen.findByText("Trợ lý chỉ hỗ trợ tư vấn sản phẩm công khai."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Thử lại yêu cầu gần nhất" }),
    ).not.toBeInTheDocument();
  });

  it("restores focus to the trigger after keyboard dismissal", async () => {
    render(<AiChatWidget />);
    const trigger = screen.getByRole("button", {
      name: "Mở FARTA Product Advisor",
    });
    fireEvent.click(trigger);
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: true, cancelable: true }),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
