import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminOrderDetail } from "../../lib/api";
import { PaymentPanel } from "./order-panels";

const conflictOrder: AdminOrderDetail = {
  id: "order-1",
  orderCode: "FAR-20261013-CONFLICT",
  customerId: null,
  recipientName: "Linh",
  phone: "+84900000000",
  status: "PAYMENT_CONFLICT",
  paymentStatus: "CONFLICT",
  paymentMethod: "FULL",
  currency: "VND",
  itemCount: 1,
  total: 329_000,
  createdAt: "2026-10-13T00:00:00.000Z",
  updatedAt: "2026-10-13T00:00:00.000Z",
  items: [],
  shipping: {
    recipientName: "Linh",
    phone: "+84900000000",
    addressLine: "Địa chỉ test",
    provinceCity: "TP. Hồ Chí Minh",
    district: null,
    ward: null,
    method: "STANDARD",
    notes: null,
  },
  itemsSubtotal: 299_000,
  shippingFee: 30_000,
  payment: {
    provider: "SEPAY",
    method: "FULL",
    status: "CONFLICT",
    expectedAmount: 329_000,
    orderTotal: 329_000,
    receivedAmount: 300_000,
    transactionReference: "TX-TEST",
    reconciliationReference: null,
    reconciliationReason: "Amount mismatch",
    reconciledBy: null,
    reconciledAt: null,
  },
  timeline: [],
  reservations: [],
  paymentEvents: [],
  audit: [],
};

describe("PaymentPanel", () => {
  afterEach(cleanup);

  it("renders a payment conflict as an explicit reconciliation state", () => {
    render(
      <PaymentPanel
        collectCod={{ mutate: vi.fn(), isPending: false }}
        order={conflictOrder}
        reason=""
        refundReference=""
        setRefundReference={vi.fn()}
        reconcile={{ mutate: vi.fn(), isPending: false }}
      />,
    );
    expect(screen.getByText("CONFLICT")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Payment cần được đối soát",
    );
    expect(
      screen.getByRole("button", { name: "Đánh dấu chờ hoàn tiền" }),
    ).toBeDisabled();
  });
});
