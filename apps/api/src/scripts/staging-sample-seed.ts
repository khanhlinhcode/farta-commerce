import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { NestFactory } from "@nestjs/core";

import { UsersService } from "../auth/services/users.service";
import { MediaService } from "../media/media.service";
import {
  runSampleCatalogSeed,
  type SeedMediaManifest,
} from "./development-seed";

const STAGING_GATE = "ONE_TIME_STAGING_SAMPLE_V1";

type AssetKey = keyof SeedMediaManifest["assets"];

const assets: Record<
  AssetKey,
  {
    publicId: string;
    secureUrl: string;
    width: number;
    height: number;
    bytes: number;
    altText: string;
  }
> = {
  heroDesktop: {
    publicId: "farta/catalog/7f0de609-9593-43cf-a840-01e397e001af",
    secureUrl:
      "https://res.cloudinary.com/ddkizvngm/image/upload/v1791817477/farta/catalog/7f0de609-9593-43cf-a840-01e397e001af.png",
    width: 1672,
    height: 941,
    bytes: 1_891_040,
    altText: "Bộ sưu tập FARTA tông đen và kem trong studio tối giản",
  },
  heroMobile: {
    publicId: "farta/catalog/c2b806d1-0a41-4009-8743-689de9ca762a",
    secureUrl:
      "https://res.cloudinary.com/ddkizvngm/image/upload/v1791817479/farta/catalog/c2b806d1-0a41-4009-8743-689de9ca762a.png",
    width: 1122,
    height: 1402,
    bytes: 1_984_521,
    altText: "Thiết kế FARTA màu kem trong ánh sáng studio",
  },
  essentialTeeBlack: {
    publicId: "farta/catalog/bf51bd11-6d82-4043-ad5c-8fd10c32d84e",
    secureUrl:
      "https://res.cloudinary.com/ddkizvngm/image/upload/v1791817480/farta/catalog/bf51bd11-6d82-4043-ad5c-8fd10c32d84e.png",
    width: 1122,
    height: 1402,
    bytes: 1_835_147,
    altText: "Áo thun FARTA Essential màu đen",
  },
  essentialTeeCream: {
    publicId: "farta/catalog/1ff280b2-d958-4483-bd64-92d75f132292",
    secureUrl:
      "https://res.cloudinary.com/ddkizvngm/image/upload/v1791817481/farta/catalog/1ff280b2-d958-4483-bd64-92d75f132292.png",
    width: 1122,
    height: 1402,
    bytes: 1_888_644,
    altText: "Áo thun FARTA Essential màu kem",
  },
  atelierDressCream: {
    publicId: "farta/catalog/26e593a6-e4ea-4942-906c-4c4bb41dfea6",
    secureUrl:
      "https://res.cloudinary.com/ddkizvngm/image/upload/v1791817482/farta/catalog/26e593a6-e4ea-4942-906c-4c4bb41dfea6.png",
    width: 1122,
    height: 1402,
    bytes: 1_743_719,
    altText: "Đầm midi FARTA Atelier màu kem",
  },
};

export function assertStagingSampleSeedEnvironment(
  appEnvironment: string | undefined,
  gate: string | undefined,
): void {
  if (appEnvironment !== "staging" || gate !== STAGING_GATE) {
    throw new Error(
      "Staging sample seed requires APP_ENV=staging and the explicit one-time gate.",
    );
  }
}

async function assertRemoteAsset(asset: (typeof assets)[AssetKey]) {
  const response = await fetch(asset.secureUrl, {
    method: "HEAD",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok || response.headers.get("content-type") !== "image/png") {
    throw new Error(`Staging sample asset is unavailable: ${asset.publicId}`);
  }
}

async function main(): Promise<void> {
  assertStagingSampleSeedEnvironment(
    process.env.APP_ENV,
    process.env.ALLOW_STAGING_SAMPLE_SEED,
  );
  const actorEmail = process.env.STAGING_SAMPLE_SEED_ACTOR_EMAIL?.trim();
  if (!actorEmail) {
    throw new Error("Set STAGING_SAMPLE_SEED_ACTOR_EMAIL.");
  }
  const { AppModule } = await import("../app.module");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const users = app.get(UsersService);
    const actorUser = await users.findForLogin(actorEmail);
    if (
      !actorUser ||
      actorUser.status !== "ACTIVE" ||
      !actorUser.roles.includes("OWNER")
    ) {
      throw new Error("Staging sample seed actor must be an active OWNER.");
    }
    const media = app.get(MediaService);
    const manifestAssets = {} as SeedMediaManifest["assets"];
    for (const key of Object.keys(assets) as AssetKey[]) {
      const source = assets[key];
      await assertRemoteAsset(source);
      const registered = await media.registerTrustedStagingSample(
        {
          ...source,
          resourceType: "image",
          format: "png",
          originalFilename: `farta-staging-sample-${key}.png`,
        },
        {
          userId: actorUser.id,
          requestId: `staging-sample-media-${randomUUID()}`,
        },
      );
      manifestAssets[key] = {
        id: registered.id,
        publicId: registered.publicId,
        width: registered.width,
        height: registered.height,
        altText: registered.altText ?? source.altText,
      };
    }
    const stats = await runSampleCatalogSeed(app, {
      actorEmail,
      manifest: {
        schemaVersion: 1,
        provider: "CLOUDINARY",
        generatedBy: "staging-sample-seed-v1",
        assets: manifestAssets,
      },
      requestPrefix: "staging-sample-seed",
      inventoryReason: "Initial staging sample catalog stock",
      inventoryIdempotencyPrefix: "staging-sample-seed-v1",
    });
    process.stdout.write(
      `Staging sample seed complete: media=${Object.keys(manifestAssets).length} created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}.\n`,
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`Staging sample seed failed: ${message}\n`);
    process.exitCode = 1;
  });
}
