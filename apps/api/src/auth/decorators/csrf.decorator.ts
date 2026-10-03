import { SetMetadata } from "@nestjs/common";

import type { AuthRealm } from "../auth.constants";

export type CsrfRequirement = {
  realm: AuthRealm;
  binding: "PRE_AUTH" | "SESSION" | "REFRESH";
};

export const CSRF_KEY = "farta.auth.csrf";
export const RequireCsrf = (requirement: CsrfRequirement) =>
  SetMetadata(CSRF_KEY, requirement);
