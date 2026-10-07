import { describe, expect, it } from "vitest";

import { assertPaymentTransition } from "./payment-state-machine";

describe("payment state machine", () => {
  it.each([
    ["UNPAID", "DEPOSIT_PAID"],
    ["UNPAID", "FULLY_PAID"],
    ["DEPOSIT_PAID", "FULLY_PAID"],
    ["FAILED", "UNPAID"],
    ["FULLY_PAID", "REFUND_PENDING"],
    ["REFUND_PENDING", "REFUNDED"],
  ] as const)("accepts %s -> %s", (current, next) => {
    expect(() => assertPaymentTransition(current, next)).not.toThrow();
  });

  it.each([
    ["UNPAID", "REFUNDED"],
    ["FULLY_PAID", "UNPAID"],
    ["REFUNDED", "FULLY_PAID"],
    ["DEPOSIT_PAID", "UNPAID"],
  ] as const)("rejects %s -> %s", (current, next) => {
    expect(() => assertPaymentTransition(current, next)).toThrow(
      "Payment cannot transition",
    );
  });
});
