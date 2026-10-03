import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";

import type { Permission } from "../auth.constants";
import { PermissionsGuard } from "./permissions.guard";

function context(principal?: Express.AuthPrincipal): ExecutionContext {
  const request = { principal } as Request;
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guard(required?: Permission[]): PermissionsGuard {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(required),
  } as unknown as Reflector;
  return new PermissionsGuard(reflector);
}

const principal: Express.AuthPrincipal = {
  userId: "507f1f77bcf86cd799439011",
  sessionId: "507f1f77bcf86cd799439012",
  realm: "STAFF",
  roles: ["STAFF"],
  permissions: ["product.read"],
  rolesVersion: 1,
};

describe("PermissionsGuard", () => {
  it("allows routes that do not declare permissions", () => {
    expect(guard().canActivate(context())).toBe(true);
  });

  it("denies missing principals and insufficient authority", () => {
    expect(() => guard(["product.update"]).canActivate(context())).toThrow(
      ForbiddenException,
    );
    expect(() =>
      guard(["product.update"]).canActivate(context(principal)),
    ).toThrow(ForbiddenException);
  });

  it("allows a principal only when every required permission is present", () => {
    expect(guard(["product.read"]).canActivate(context(principal))).toBe(true);
  });
});
