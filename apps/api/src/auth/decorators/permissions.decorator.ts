import { SetMetadata } from "@nestjs/common";

import type { Permission } from "../auth.constants";

export const PERMISSIONS_KEY = "farta.auth.permissions";
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
