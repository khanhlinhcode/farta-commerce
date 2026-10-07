import { describe, expect, it } from "vitest";

import { assertOrderTransition } from "./order-state-machine";

describe("order state machine", () => {
  it.each([
    ["CREATED", "CONFIRMED"],
    ["CONFIRMED", "PACKING"],
    ["PACKING", "SHIPPING"],
    ["SHIPPING", "DELIVERED"],
    ["DELIVERED", "COMPLETED"],
    ["CREATED", "CANCELLED"],
    ["CONFIRMED", "PAYMENT_CONFLICT"],
    ["PAYMENT_CONFLICT", "CONFIRMED"],
  ] as const)("accepts %s -> %s", (current, next) => {
    expect(() => assertOrderTransition(current, next)).not.toThrow();
  });

  it.each([
    ["CREATED", "SHIPPING"],
    ["PACKING", "CANCELLED"],
    ["DELIVERED", "CREATED"],
    ["COMPLETED", "CONFIRMED"],
    ["CANCELLED", "CREATED"],
  ] as const)("rejects %s -> %s", (current, next) => {
    expect(() => assertOrderTransition(current, next)).toThrow(
      "Order cannot transition",
    );
  });
});
