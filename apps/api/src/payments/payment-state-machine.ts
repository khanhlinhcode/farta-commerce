import { HttpStatus } from "@nestjs/common";

import { ApiException } from "../common/api-exception";
import type { PaymentStatus } from "./schemas/payment.schema";

const transitions: Readonly<
  Record<PaymentStatus, ReadonlyArray<PaymentStatus>>
> = {
  UNPAID: ["DEPOSIT_PAID", "FULLY_PAID", "FAILED", "EXPIRED", "CONFLICT"],
  DEPOSIT_PAID: ["FULLY_PAID", "REFUND_PENDING", "CONFLICT"],
  FULLY_PAID: ["REFUND_PENDING", "CONFLICT"],
  FAILED: ["UNPAID", "CONFLICT"],
  EXPIRED: ["UNPAID", "CONFLICT"],
  REFUND_PENDING: ["REFUNDED", "CONFLICT"],
  REFUNDED: [],
  CONFLICT: ["UNPAID", "REFUND_PENDING"],
};

export function assertPaymentTransition(
  current: PaymentStatus,
  next: PaymentStatus,
): void {
  if (!transitions[current].includes(next)) {
    throw new ApiException(
      HttpStatus.CONFLICT,
      "INVALID_PAYMENT_TRANSITION",
      `Payment cannot transition from ${current} to ${next}.`,
    );
  }
}
