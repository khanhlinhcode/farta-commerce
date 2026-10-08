import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaymentPanel } from "./payment-panel";

const instructions = {
  orderCode: "FAR-20261008-TEST",
  status: "UNPAID",
  receivedAmount: 0,
  orderTotal: 329000,
  instructions: {
    provider: "SEPAY",
    method: "FULL",
    amount: 329000,
    currency: "VND",
    reference: "FAR20261008TEST",
    expiresAt: "2099-01-01T00:00:00.000Z",
    bank: {
      name: "TestBank",
      accountNumber: "0123456789",
      accountHolder: "FARTA TEST",
    },
    qrUrl:
      "https://vietqr.app/img?acc=0123456789&bank=TestBank&amount=329000&des=FAR20261008TEST",
  },
};

function paymentStatus(
  status: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    orderCode: instructions.orderCode,
    provider: "SEPAY",
    method: "FULL",
    status,
    currency: "VND",
    expectedAmount: 329000,
    receivedAmount: status === "FULLY_PAID" ? 329000 : 0,
    orderTotal: 329000,
    amountDue: status === "FULLY_PAID" ? 0 : 329000,
    reference: instructions.instructions.reference,
    expiresAt:
      status === "FULLY_PAID" ? null : instructions.instructions.expiresAt,
    updatedAt: "2026-10-08T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderPayment(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  const result = render(
    <QueryClientProvider client={client}>
      <PaymentPanel orderCode="FAR-20261008-TEST" />
    </QueryClientProvider>,
  );
  return { client, ...result };
}

describe("PaymentPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows success only after the server payment status is fully paid", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(paymentStatus("FULLY_PAID")),
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    renderPayment(client);

    expect(
      await screen.findByRole("heading", {
        name: "Thanh toán đã được xác nhận.",
      }),
    ).toBeVisible();
    expect(screen.getByText(/webhook đã xác thực/)).toBeVisible();
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["order", instructions.orderCode],
      }),
    );
  });

  it("hides the stale deposit QR until remaining-payment instructions refresh", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          paymentStatus("UNPAID", {
            method: "DEPOSIT",
            expectedAmount: 100000,
            amountDue: 100000,
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            ...instructions,
            instructions: {
              ...instructions.instructions,
              method: "DEPOSIT",
              amount: 100000,
            },
          },
          201,
        ),
      );

    const { client } = renderPayment();
    expect(await screen.findByRole("img")).toBeVisible();
    act(() => {
      client.setQueryData(
        ["payment-status", instructions.orderCode],
        paymentStatus("DEPOSIT_PAID", {
          method: "DEPOSIT",
          expectedAmount: 100000,
          receivedAmount: 100000,
          amountDue: 229000,
        }),
      );
    });

    expect(
      await screen.findByRole("heading", {
        name: "Cần tạo QR cho phần còn lại",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not show an old QR for a failed server payment state", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(paymentStatus("FAILED")));

    renderPayment();

    expect(
      await screen.findByRole("heading", {
        name: "Thanh toán chưa thành công",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each(["REFUND_PENDING", "REFUNDED", "EXPIRED", "UNKNOWN_STATUS"])(
    "fails closed without a QR for %s",
    async (status) => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(jsonResponse(paymentStatus(status)));

      renderPayment();

      const heading =
        status === "EXPIRED"
          ? "Phiên thanh toán đã hết hạn"
          : status === "UNKNOWN_STATUS"
            ? "Trạng thái thanh toán chưa được hỗ trợ"
            : status === "REFUND_PENDING"
              ? "Thanh toán đang được xử lý hoàn tiền"
              : "Thanh toán đã được hoàn tiền";
      expect(
        await screen.findByRole("heading", { name: heading }),
      ).toBeVisible();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    },
  );
});
