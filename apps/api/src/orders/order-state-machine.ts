import { HttpStatus } from "@nestjs/common";

import { ApiException } from "../common/api-exception";
import type { OrderStatus } from "./schemas/order.schema";

const transitions: Readonly<Record<OrderStatus, ReadonlyArray<OrderStatus>>> = {
  CREATED: ["CONFIRMED", "CANCELLED", "PAYMENT_CONFLICT"],
  CONFIRMED: ["PACKING", "CANCELLED", "PAYMENT_CONFLICT"],
  PACKING: ["SHIPPING"],
  SHIPPING: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  PAYMENT_CONFLICT: ["CONFIRMED", "CANCELLED"],
};

export function assertOrderTransition(
  current: OrderStatus,
  next: OrderStatus,
): void {
  if (!transitions[current].includes(next)) {
    throw new ApiException(
      HttpStatus.CONFLICT,
      "INVALID_ORDER_TRANSITION",
      `Order cannot transition from ${current} to ${next}.`,
    );
  }
}
