import { SetMetadata } from "@nestjs/common";

import type { AuthRealm } from "../auth.constants";

export const AUTH_REALM_KEY = "farta.auth.realm";
export const RequireAuth = (realm: AuthRealm) =>
  SetMetadata(AUTH_REALM_KEY, realm);
