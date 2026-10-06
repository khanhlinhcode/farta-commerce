import { SetMetadata } from "@nestjs/common";

import type { AuthRealm } from "../auth.constants";

export const AUTH_REALM_KEY = "farta.auth.realm";
export const OPTIONAL_AUTH_REALM_KEY = "farta.auth.optional-realm";
export const RequireAuth = (realm: AuthRealm) =>
  SetMetadata(AUTH_REALM_KEY, realm);
export const OptionalAuth = (realm: AuthRealm) =>
  SetMetadata(OPTIONAL_AUTH_REALM_KEY, realm);
