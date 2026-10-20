import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/mongoose";
import { readFileSync } from "node:fs";
import type { Connection } from "mongoose";

import type { Environment } from "../config/environment";

type BootstrapInput = {
  email: string;
  password: string;
  displayName: string;
};

export function assertOwnerBootstrapEnvironment(
  appEnvironment: Environment["APP_ENV"],
  stagingGate: string | undefined,
): void {
  if (appEnvironment === "development" || appEnvironment === "test") return;
  if (
    appEnvironment === "staging" &&
    stagingGate === "ONE_TIME_STAGING_OWNER_V1"
  )
    return;
  throw new Error(
    "Owner bootstrap is restricted to development/test or an explicitly enabled one-time staging run.",
  );
}

function stagingInput(): BootstrapInput {
  const path = process.env.STAGING_BOOTSTRAP_CONFIG_FILE;
  if (!path) throw new Error("Set STAGING_BOOTSTRAP_CONFIG_FILE for staging.");
  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as Partial<BootstrapInput>;
  if (
    typeof parsed.email !== "string" ||
    typeof parsed.password !== "string" ||
    typeof parsed.displayName !== "string"
  ) {
    throw new Error("Staging bootstrap configuration is invalid.");
  }
  return {
    email: parsed.email,
    password: parsed.password,
    displayName: parsed.displayName,
  };
}

export async function bootstrapOwner(): Promise<void> {
  // Keep AppModule lazy so importing the pure environment guard in unit tests
  // does not initialize ConfigModule or require a complete runtime environment.
  const [{ AppModule }, { PasswordService }, { UsersService }] =
    await Promise.all([
      import("../app.module"),
      import("../auth/services/password.service"),
      import("../auth/services/users.service"),
    ]);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const config = app.get<ConfigService<Environment, true>>(ConfigService);
    const appEnvironment = config.get("APP_ENV", { infer: true });
    assertOwnerBootstrapEnvironment(
      appEnvironment,
      process.env.ALLOW_STAGING_OWNER_BOOTSTRAP,
    );
    const input =
      appEnvironment === "staging"
        ? stagingInput()
        : {
            email: config.get("BOOTSTRAP_OWNER_EMAIL", { infer: true }),
            password: config.get("BOOTSTRAP_OWNER_PASSWORD", { infer: true }),
            displayName: config.get("BOOTSTRAP_OWNER_DISPLAY_NAME", {
              infer: true,
            }),
          };
    const minimumLength = appEnvironment === "staging" ? 20 : 12;
    if (
      !input.email ||
      !input.displayName ||
      input.password.length < minimumLength
    )
      throw new Error(
        `Set owner email, display name and a password of at least ${minimumLength} characters.`,
      );

    const passwords = app.get(PasswordService);
    const users = app.get(UsersService);
    const connection = app.get<Connection>(getConnectionToken());
    const normalizedEmail = users.normalizeEmail(input.email);
    const existingOwner = await connection.collection("users").findOne({
      roles: "OWNER",
      status: "ACTIVE",
    });
    if (existingOwner) {
      if (existingOwner.normalizedEmail === normalizedEmail) {
        process.stdout.write("Owner already exists; no changes applied.\n");
        return;
      }
      throw new Error(
        "An active OWNER already exists; refusing to create another bootstrap owner.",
      );
    }
    await users.createDevelopmentOwner({
      email: input.email,
      displayName: input.displayName,
      passwordHash: await passwords.hash(input.password),
    });
    process.stdout.write(
      "Owner created. Clear the one-time bootstrap input now.\n",
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void bootstrapOwner().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`Owner bootstrap failed: ${message}\n`);
    process.exitCode = 1;
  });
}
