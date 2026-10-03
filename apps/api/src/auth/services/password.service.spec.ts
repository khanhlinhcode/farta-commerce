import type { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";

import type { Environment } from "../../config/environment";
import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const config = {
    get: (key: keyof Environment) => (key === "BCRYPT_COST" ? 10 : undefined),
  } as ConfigService<Environment, true>;
  const service = new PasswordService(config);

  it("hashes and verifies a password without retaining plaintext", async () => {
    const password = "correct horse battery staple";
    const hash = await service.hash(password);

    expect(hash).not.toContain(password);
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    await expect(service.verify(password, hash)).resolves.toBe(true);
    await expect(service.verify("incorrect password", hash)).resolves.toBe(
      false,
    );
  });
});
