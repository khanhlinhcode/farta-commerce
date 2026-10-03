export const REALMS = ["CUSTOMER", "STAFF"] as const;
export type AuthRealm = (typeof REALMS)[number];

export const ROLES = ["CUSTOMER", "STAFF", "ADMIN", "OWNER"] as const;
export type AuthRole = (typeof ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "LOCKED", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PERMISSIONS = [
  "product.read",
  "product.create",
  "product.update",
  "product.publish",
  "product.archive",
  "category.read",
  "category.create",
  "category.update",
  "category.archive",
  "inventory.read",
  "inventory.adjust",
  "order.read",
  "order.update",
  "order.cancel",
  "customer.read",
  "customer.update",
  "media.read",
  "media.create",
  "media.archive",
  "banner.read",
  "banner.create",
  "banner.update",
  "banner.publish",
  "banner.archive",
  "audit.read",
  "staff.manage",
  "role.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
