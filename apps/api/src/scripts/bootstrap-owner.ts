import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module";
import type { Environment } from "../config/environment";
import { PasswordService } from "../auth/services/password.service";
import { UsersService } from "../auth/services/users.service";

async function bootstrapOwner(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const config = app.get<ConfigService<Environment, true>>(ConfigService);
    const appEnvironment = config.get("APP_ENV", { infer: true });
    if (appEnvironment !== "development" && appEnvironment !== "test")
      throw new Error("Owner bootstrap is restricted to development and test.");

    const email = config.get("BOOTSTRAP_OWNER_EMAIL", { infer: true });
    const password = config.get("BOOTSTRAP_OWNER_PASSWORD", { infer: true });
    const displayName = config.get("BOOTSTRAP_OWNER_DISPLAY_NAME", {
      infer: true,
    });
    if (!email || !displayName || password.length < 12)
      throw new Error(
        "Set BOOTSTRAP_OWNER_EMAIL, BOOTSTRAP_OWNER_DISPLAY_NAME and a password of at least 12 characters.",
      );

    const passwords = app.get(PasswordService);
    const users = app.get(UsersService);
    await users.createDevelopmentOwner({
      email,
      displayName,
      passwordHash: await passwords.hash(password),
    });
    process.stdout.write(
      "Development owner created. Clear bootstrap variables now.\n",
    );
  } finally {
    await app.close();
  }
}

void bootstrapOwner();
