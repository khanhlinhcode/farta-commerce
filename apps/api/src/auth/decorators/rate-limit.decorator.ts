import { SetMetadata } from "@nestjs/common";

export type RateLimitPolicy =
  | "AUTH_LOGIN"
  | "AUTH_REFRESH"
  | "CART_MUTATION"
  | "CART_MERGE"
  | "CHECKOUT"
  | "ORDER_LOOKUP";
export const RATE_LIMIT_KEY = "farta.rate-limit.policy";
export const RateLimit = (policy: RateLimitPolicy) =>
  SetMetadata(RATE_LIMIT_KEY, policy);
