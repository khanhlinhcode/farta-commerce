import "reflect-metadata";

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { Types, type Connection } from "mongoose";

import { AppModule } from "../app.module";
import { UsersService } from "../auth/services/users.service";
import { BannersService } from "../banners/banners.service";
import { CategoriesService } from "../categories/categories.service";
import { InventoryService } from "../inventory/inventory.service";
import { ProductsService } from "../products/products.service";
import { VariantsService } from "../variants/variants.service";

const SEED_MEDIA_MANIFEST = resolve(
  process.cwd(),
  ".development-seed-media.json",
);
const SEED_TAG = "development-seed";

type SeedActor = { userId: string; requestId: string };
type SeedStats = { created: number; updated: number; skipped: number };
type SeedAssetKey =
  | "heroDesktop"
  | "heroMobile"
  | "essentialTeeBlack"
  | "essentialTeeCream"
  | "atelierDressCream";
type SeedAsset = {
  id: string;
  publicId: string;
  width: number;
  height: number;
  altText: string;
};
type SeedMediaManifest = {
  schemaVersion: 1;
  provider: "CLOUDINARY";
  generatedBy: string;
  assets: Record<SeedAssetKey, SeedAsset>;
};
type OwnedDocument = {
  _id: { toString(): string };
  createdBy?: { toString(): string } | null;
  archivedAt?: Date | null;
};

const categories = [
  {
    slug: "dev-farta-thoi-trang",
    name: "Thời trang FARTA",
    description: "Những thiết kế tối giản dành cho nhịp sống hiện đại.",
    parentSlug: null,
    imageKey: "heroMobile" as const,
    sortOrder: 10,
  },
  {
    slug: "dev-farta-ao-thun",
    name: "Áo thun",
    description: "Phom dáng thư thái, chất liệu dày dặn và dễ phối.",
    parentSlug: "dev-farta-thoi-trang",
    imageKey: "essentialTeeCream" as const,
    sortOrder: 20,
  },
  {
    slug: "dev-farta-dam",
    name: "Đầm",
    description: "Đường nét tinh gọn với bảng màu trung tính đặc trưng.",
    parentSlug: "dev-farta-thoi-trang",
    imageKey: "atelierDressCream" as const,
    sortOrder: 30,
  },
] as const;

const products = [
  {
    slug: "dev-farta-essential-tee",
    name: "FARTA Essential Tee",
    shortDescription: "Áo thun cotton dày dặn với phom relaxed hiện đại.",
    description:
      "Thiết kế cổ tròn tối giản, bề mặt cotton mềm và cấu trúc đứng phom. Phù hợp cho những lớp phối hằng ngày.",
    categorySlug: "dev-farta-ao-thun",
    coverKey: "essentialTeeBlack" as const,
    mediaKeys: ["essentialTeeBlack", "essentialTeeCream"] as const,
    tags: [SEED_TAG, "new-arrival", "essential"],
    variants: [
      {
        sku: "DEV-FAR-TEE-BLK-S",
        color: "Đen",
        colorCode: "#171717",
        size: "S",
        price: 399000,
        compareAtPrice: 459000,
        mediaKey: "essentialTeeBlack" as const,
        stock: 12,
      },
      {
        sku: "DEV-FAR-TEE-BLK-M",
        color: "Đen",
        colorCode: "#171717",
        size: "M",
        price: 399000,
        compareAtPrice: 459000,
        mediaKey: "essentialTeeBlack" as const,
        stock: 18,
      },
      {
        sku: "DEV-FAR-TEE-BLK-L",
        color: "Đen",
        colorCode: "#171717",
        size: "L",
        price: 399000,
        compareAtPrice: 459000,
        mediaKey: "essentialTeeBlack" as const,
        stock: 8,
      },
      {
        sku: "DEV-FAR-TEE-CRM-S",
        color: "Kem",
        colorCode: "#E8E0D1",
        size: "S",
        price: 399000,
        compareAtPrice: 459000,
        mediaKey: "essentialTeeCream" as const,
        stock: 10,
      },
      {
        sku: "DEV-FAR-TEE-CRM-M",
        color: "Kem",
        colorCode: "#E8E0D1",
        size: "M",
        price: 399000,
        compareAtPrice: 459000,
        mediaKey: "essentialTeeCream" as const,
        stock: 14,
      },
      {
        sku: "DEV-FAR-TEE-CRM-L",
        color: "Kem",
        colorCode: "#E8E0D1",
        size: "L",
        price: 399000,
        compareAtPrice: 459000,
        mediaKey: "essentialTeeCream" as const,
        stock: 5,
      },
    ],
  },
  {
    slug: "dev-farta-atelier-midi-dress",
    name: "FARTA Atelier Midi Dress",
    shortDescription: "Đầm midi màu kem với cấu trúc chiết eo thanh lịch.",
    description:
      "Một thiết kế studio cân bằng giữa đường nét gọn gàng và chuyển động mềm mại, hoàn thiện bằng tông kem ấm.",
    categorySlug: "dev-farta-dam",
    coverKey: "atelierDressCream" as const,
    mediaKeys: ["atelierDressCream"] as const,
    tags: [SEED_TAG, "new-arrival", "atelier"],
    variants: [
      {
        sku: "DEV-FAR-DRS-CRM-S",
        color: "Kem",
        colorCode: "#E8E0D1",
        size: "S",
        price: 1299000,
        compareAtPrice: null,
        mediaKey: "atelierDressCream" as const,
        stock: 6,
      },
      {
        sku: "DEV-FAR-DRS-CRM-M",
        color: "Kem",
        colorCode: "#E8E0D1",
        size: "M",
        price: 1299000,
        compareAtPrice: null,
        mediaKey: "atelierDressCream" as const,
        stock: 7,
      },
      {
        sku: "DEV-FAR-DRS-CRM-L",
        color: "Kem",
        colorCode: "#E8E0D1",
        size: "L",
        price: 1299000,
        compareAtPrice: null,
        mediaKey: "atelierDressCream" as const,
        stock: 3,
      },
    ],
  },
] as const;

export function assertDevelopmentSeedEnvironment(value: string | undefined) {
  if (value !== "development") {
    throw new Error(
      "Development seed is restricted to APP_ENV=development; missing, test, staging, production and unknown environments are refused.",
    );
  }
}

export function parseDevelopmentSeedManifest(raw: string): SeedMediaManifest {
  const parsed = JSON.parse(raw) as Partial<SeedMediaManifest>;
  const keys: SeedAssetKey[] = [
    "heroDesktop",
    "heroMobile",
    "essentialTeeBlack",
    "essentialTeeCream",
    "atelierDressCream",
  ];
  if (
    parsed.schemaVersion !== 1 ||
    parsed.provider !== "CLOUDINARY" ||
    !parsed.generatedBy ||
    !parsed.assets ||
    keys.some((key) => {
      const asset = parsed.assets?.[key];
      return (
        !asset ||
        !/^[a-f0-9]{24}$/.test(asset.id) ||
        !asset.publicId.startsWith("farta/catalog/") ||
        !Number.isSafeInteger(asset.width) ||
        asset.width < 1 ||
        !Number.isSafeInteger(asset.height) ||
        asset.height < 1 ||
        !asset.altText.trim()
      );
    })
  ) {
    throw new Error("Development seed media manifest is invalid.");
  }
  return parsed as SeedMediaManifest;
}

function sameStrings(actual: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(actual) &&
    actual.map(String).join("|") === expected.map(String).join("|")
  );
}

export function assertSeedOwnership(
  document: OwnedDocument,
  actorId: string,
  resource: string,
): void {
  if (document.archivedAt || document.createdBy?.toString() !== actorId) {
    throw new Error(
      `Seed namespace collision for ${resource}; refusing to modify non-seed or archived data.`,
    );
  }
}

async function validateMedia(
  connection: Connection,
  manifest: SeedMediaManifest,
): Promise<void> {
  const expected = Object.values(manifest.assets);
  const media = await connection
    .collection("media_assets")
    .find({
      _id: {
        $in: expected.map((asset) => new Types.ObjectId(asset.id)),
      },
      archivedAt: null,
      provider: "CLOUDINARY",
      resourceType: "image",
    })
    .project({ _id: 1, publicId: 1 })
    .toArray();
  const byId = new Map(
    media.map((asset) => [String(asset._id), asset.publicId]),
  );
  if (expected.some((asset) => byId.get(asset.id) !== asset.publicId)) {
    throw new Error(
      "Development seed media is missing, archived or does not match the finalized Cloudinary MediaAsset records.",
    );
  }
}

async function runDevelopmentSeed(
  app: INestApplicationContext,
): Promise<SeedStats> {
  assertDevelopmentSeedEnvironment(process.env.APP_ENV);
  const actorEmail = process.env.DEVELOPMENT_SEED_ACTOR_EMAIL?.trim();
  if (!actorEmail) {
    throw new Error(
      "Set DEVELOPMENT_SEED_ACTOR_EMAIL to an existing active OWNER account.",
    );
  }

  const connection = app.get<Connection>(getConnectionToken());
  const users = app.get(UsersService);
  const actorUser = await users.findForLogin(actorEmail);
  if (
    !actorUser ||
    actorUser.status !== "ACTIVE" ||
    !actorUser.roles.includes("OWNER")
  ) {
    throw new Error("Development seed actor must be an existing active OWNER.");
  }

  const manifest = parseDevelopmentSeedManifest(
    readFileSync(SEED_MEDIA_MANIFEST, "utf8"),
  );
  await validateMedia(connection, manifest);

  const categoryService = app.get(CategoriesService);
  const productService = app.get(ProductsService);
  const variantService = app.get(VariantsService);
  const inventoryService = app.get(InventoryService);
  const bannerService = app.get(BannersService);
  const actor: SeedActor = {
    userId: actorUser.id,
    requestId: `development-seed-${randomUUID()}`,
  };
  const stats: SeedStats = { created: 0, updated: 0, skipped: 0 };
  const categoryIds = new Map<string, string>();

  for (const definition of categories) {
    const parentCategoryId = definition.parentSlug
      ? (categoryIds.get(definition.parentSlug) ?? null)
      : null;
    if (definition.parentSlug && !parentCategoryId) {
      throw new Error(
        `Seed parent category ${definition.parentSlug} is missing.`,
      );
    }
    const expected = {
      name: definition.name,
      slug: definition.slug,
      description: definition.description,
      imageMediaId: manifest.assets[definition.imageKey].id,
      parentCategoryId,
      status: "ACTIVE" as const,
      sortOrder: definition.sortOrder,
      seo: {
        title: definition.name,
        description: definition.description,
      },
    };
    const existing = (await connection
      .collection("categories")
      .findOne({ slug: definition.slug })) as
      (OwnedDocument & Record<string, unknown>) | null;
    if (!existing) {
      const created = await categoryService.create(expected, actor);
      categoryIds.set(definition.slug, created.id);
      stats.created += 1;
      continue;
    }
    assertSeedOwnership(existing, actor.userId, `category:${definition.slug}`);
    const same =
      existing.name === expected.name &&
      existing.description === expected.description &&
      String(existing.imageMediaId ?? "") === expected.imageMediaId &&
      String(existing.parentCategoryId ?? "") ===
        (expected.parentCategoryId ?? "") &&
      existing.status === expected.status &&
      existing.sortOrder === expected.sortOrder;
    if (same) {
      stats.skipped += 1;
    } else {
      await categoryService.update(existing._id.toString(), expected, actor);
      stats.updated += 1;
    }
    categoryIds.set(definition.slug, existing._id.toString());
  }

  for (const definition of products) {
    const categoryId = categoryIds.get(definition.categorySlug);
    if (!categoryId)
      throw new Error(`Seed category ${definition.categorySlug} is missing.`);
    const mediaIds = definition.mediaKeys.map((key) => manifest.assets[key].id);
    const expected = {
      name: definition.name,
      slug: definition.slug,
      shortDescription: definition.shortDescription,
      description: definition.description,
      categoryIds: [categoryId],
      tags: [...definition.tags],
      coverMediaId: manifest.assets[definition.coverKey].id,
      mediaIds,
      seo: {
        title: definition.name,
        description: definition.shortDescription,
      },
    };
    let existing = (await connection
      .collection("products")
      .findOne({ slug: definition.slug })) as
      (OwnedDocument & Record<string, unknown>) | null;
    let productId: string;
    if (!existing) {
      const created = await productService.create(
        { ...expected, status: "DRAFT" },
        actor,
      );
      productId = created.id;
      stats.created += 1;
    } else {
      assertSeedOwnership(existing, actor.userId, `product:${definition.slug}`);
      if (!Array.isArray(existing.tags) || !existing.tags.includes(SEED_TAG)) {
        throw new Error(
          `Seed marker is missing for product:${definition.slug}.`,
        );
      }
      productId = existing._id.toString();
    }

    for (const variant of definition.variants) {
      const variantExpected = {
        sku: variant.sku,
        color: variant.color,
        colorCode: variant.colorCode,
        size: variant.size,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        status: "ACTIVE" as const,
        mediaIds: [manifest.assets[variant.mediaKey].id],
        lowStockThreshold: 4,
      };
      const existingVariant = (await connection
        .collection("product_variants")
        .findOne({ sku: variant.sku })) as
        (OwnedDocument & Record<string, unknown>) | null;
      let variantId: string;
      if (!existingVariant) {
        const created = await variantService.create(
          productId,
          variantExpected,
          actor,
        );
        variantId = created.id;
        stats.created += 1;
      } else {
        assertSeedOwnership(
          existingVariant,
          actor.userId,
          `variant:${variant.sku}`,
        );
        if (String(existingVariant.productId) !== productId) {
          throw new Error(`Seed SKU collision for variant:${variant.sku}.`);
        }
        variantId = existingVariant._id.toString();
        const same =
          existingVariant.color === variantExpected.color &&
          existingVariant.colorCode === variantExpected.colorCode &&
          existingVariant.size === variantExpected.size &&
          existingVariant.price === variantExpected.price &&
          (existingVariant.compareAtPrice ?? null) ===
            variantExpected.compareAtPrice &&
          existingVariant.status === variantExpected.status &&
          existingVariant.lowStockThreshold ===
            variantExpected.lowStockThreshold &&
          sameStrings(existingVariant.mediaIds, variantExpected.mediaIds);
        if (same) {
          stats.skipped += 1;
        } else {
          await variantService.update(
            productId,
            variantId,
            variantExpected,
            actor,
          );
          stats.updated += 1;
        }
      }

      const inventory = await inventoryService.get(variantId);
      if (
        inventory.onHand === 0 &&
        inventory.reserved === 0 &&
        variant.stock > 0
      ) {
        await inventoryService.adjust(
          variantId,
          variant.stock,
          "Initial development catalog stock",
          `development-seed-v1:${variant.sku}:stock:${variant.stock}`,
          actor,
        );
        stats.updated += 1;
      } else {
        stats.skipped += 1;
      }
    }

    existing = (await connection
      .collection("products")
      .findOne({ _id: new Types.ObjectId(productId) })) as
      (OwnedDocument & Record<string, unknown>) | null;
    if (!existing)
      throw new Error(`Seed product ${definition.slug} disappeared.`);
    const productSame =
      existing.name === expected.name &&
      existing.shortDescription === expected.shortDescription &&
      existing.description === expected.description &&
      existing.status === "ACTIVE" &&
      String(existing.coverMediaId ?? "") === expected.coverMediaId &&
      sameStrings(existing.categoryIds, expected.categoryIds) &&
      sameStrings(existing.mediaIds, expected.mediaIds) &&
      sameStrings(existing.tags, expected.tags);
    if (productSame) {
      stats.skipped += 1;
    } else {
      await productService.update(
        productId,
        { ...expected, status: "ACTIVE" },
        actor,
      );
      stats.updated += 1;
    }
  }

  const bannerExpected = {
    title: "Quiet Form — Bộ sưu tập mới",
    subtitle: "Sắc đen, kem và những đường nét dành cho nhịp sống hiện đại.",
    desktopMediaId: manifest.assets.heroDesktop.id,
    mobileMediaId: manifest.assets.heroMobile.id,
    ctaLabel: "Khám phá bộ sưu tập",
    ctaTarget: "/new-arrivals",
    position: "home-hero",
    priority: 100,
    startAt: null,
    endAt: null,
    status: "ACTIVE" as const,
  };
  const existingBanner = (await connection
    .collection("banners")
    .findOne({ title: bannerExpected.title })) as
    (OwnedDocument & Record<string, unknown>) | null;
  if (!existingBanner) {
    await bannerService.create(bannerExpected, actor);
    stats.created += 1;
  } else {
    assertSeedOwnership(existingBanner, actor.userId, "banner:quiet-form");
    const same =
      existingBanner.subtitle === bannerExpected.subtitle &&
      String(existingBanner.desktopMediaId) === bannerExpected.desktopMediaId &&
      String(existingBanner.mobileMediaId) === bannerExpected.mobileMediaId &&
      existingBanner.ctaLabel === bannerExpected.ctaLabel &&
      existingBanner.ctaTarget === bannerExpected.ctaTarget &&
      existingBanner.position === bannerExpected.position &&
      existingBanner.priority === bannerExpected.priority &&
      existingBanner.status === bannerExpected.status;
    if (same) {
      stats.skipped += 1;
    } else {
      await bannerService.update(
        existingBanner._id.toString(),
        bannerExpected,
        actor,
      );
      stats.updated += 1;
    }
  }

  return stats;
}

async function main(): Promise<void> {
  assertDevelopmentSeedEnvironment(process.env.APP_ENV);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const stats = await runDevelopmentSeed(app);
    process.stdout.write(
      `Development seed complete: created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}.\n`,
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`Development seed failed: ${message}\n`);
    process.exitCode = 1;
  });
}
