import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "../auth.constants";
import { PermissionsService } from "./permissions.service";

describe("PermissionsService", () => {
  const service = new PermissionsService();

  it("keeps customer and staff authority constrained", () => {
    expect(service.effectivePermissions(["CUSTOMER"], [])).toEqual([
      "product.read",
      "order.read",
      "order.cancel",
    ]);
    expect(service.effectivePermissions(["STAFF"], ["inventory.read"])).toEqual(
      ["inventory.read"],
    );
  });

  it("reserves owner permission management from ordinary admins", () => {
    expect(service.effectivePermissions(["ADMIN"], [])).not.toContain(
      "role.manage",
    );
    expect(service.effectivePermissions(["OWNER"], [])).toEqual([
      ...PERMISSIONS,
    ]);
  });
});
