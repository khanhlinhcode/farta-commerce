export const CART_OWNER_TYPES = ["GUEST", "CUSTOMER"] as const;
export type CartOwnerType = (typeof CART_OWNER_TYPES)[number];

export const CART_STATUSES = [
  "ACTIVE",
  "MERGED",
  "CONVERTED",
  "EXPIRED",
] as const;
export type CartStatus = (typeof CART_STATUSES)[number];

export type CartOwner =
  | { type: "CUSTOMER"; customerId: string }
  | { type: "GUEST"; credentialDigest: string };
