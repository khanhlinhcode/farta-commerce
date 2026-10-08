export const PAYMENT_STATUSES = [
  "UNPAID",
  "DEPOSIT_PAID",
  "FULLY_PAID",
  "FAILED",
  "EXPIRED",
  "REFUND_PENDING",
  "REFUNDED",
  "CONFLICT",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
