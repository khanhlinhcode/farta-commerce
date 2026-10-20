import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/mongoose";
import type { Connection } from "mongoose";

const STAGING_GATE = "CREATE_DECLARED_INDEXES_V1";

export function assertStagingIndexEnvironment(
  appEnvironment: string | undefined,
  gate: string | undefined,
): void {
  if (appEnvironment !== "staging" || gate !== STAGING_GATE) {
    throw new Error(
      "Declared index creation requires APP_ENV=staging and the explicit one-time gate.",
    );
  }
}

export async function createDeclaredIndexes(): Promise<void> {
  assertStagingIndexEnvironment(
    process.env.APP_ENV,
    process.env.ALLOW_STAGING_INDEX_BOOTSTRAP,
  );
  const { AppModule } = await import("../app.module");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const connection = app.get<Connection>(getConnectionToken());
    const modelNames = connection.modelNames().sort();
    for (const modelName of modelNames) {
      // createIndexes adds only schema-declared indexes. It does not drop
      // provider-managed or historical indexes as syncIndexes could.
      await connection.model(modelName).createIndexes();
    }
    process.stdout.write(
      `Declared index creation complete: models=${modelNames.length}.\n`,
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void createDeclaredIndexes().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`Declared index creation failed: ${message}\n`);
    process.exitCode = 1;
  });
}
