export const nextOrderStatuses: Readonly<Record<string, readonly string[]>> = {
  CREATED: ["CONFIRMED"],
  CONFIRMED: ["PACKING"],
  PACKING: ["SHIPPING"],
  SHIPPING: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
};

export function allowedOrderTransitions(status: string): readonly string[] {
  return nextOrderStatuses[status] ?? [];
}
