import { Injectable } from "@nestjs/common";

import { PERMISSIONS, type AuthRole, type Permission } from "../auth.constants";

@Injectable()
export class PermissionsService {
  effectivePermissions(
    roles: ReadonlyArray<AuthRole>,
    assigned: ReadonlyArray<Permission>,
  ): ReadonlyArray<Permission> {
    if (roles.includes("OWNER")) return [...PERMISSIONS];
    if (roles.includes("ADMIN"))
      return PERMISSIONS.filter((permission) => permission !== "role.manage");
    if (roles.includes("STAFF")) return [...new Set(assigned)];
    return ["product.read", "order.read", "order.cancel"];
  }
}
