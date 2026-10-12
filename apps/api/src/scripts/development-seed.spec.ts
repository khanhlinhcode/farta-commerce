import { describe, expect, it } from "vitest";

import {
  assertDevelopmentSeedEnvironment,
  assertSeedOwnership,
  parseDevelopmentSeedManifest,
} from "./development-seed";

const asset = (id: string, suffix: string) => ({
  id,
  publicId: `farta/catalog/${suffix}`,
  width: 1200,
  height: 1500,
  altText: "Development fashion asset",
});

const validManifest = JSON.stringify({
  schemaVersion: 1,
  provider: "CLOUDINARY",
  generatedBy: "OpenAI imagegen",
  assets: {
    heroDesktop: asset("000000000000000000000001", "hero-desktop"),
    heroMobile: asset("000000000000000000000002", "hero-mobile"),
    essentialTeeBlack: asset("000000000000000000000003", "tee-black"),
    essentialTeeCream: asset("000000000000000000000004", "tee-cream"),
    atelierDressCream: asset("000000000000000000000005", "dress-cream"),
  },
});

describe("development seed safety", () => {
  it("accepts development only", () => {
    expect(() => assertDevelopmentSeedEnvironment("development")).not.toThrow();
    for (const value of [
      undefined,
      "",
      "test",
      "staging",
      "production",
      "unknown",
    ]) {
      expect(() => assertDevelopmentSeedEnvironment(value)).toThrow(
        /APP_ENV=development/,
      );
    }
  });

  it("accepts a complete finalized-media manifest", () => {
    const manifest = parseDevelopmentSeedManifest(validManifest);
    expect(manifest.assets.heroDesktop.publicId).toBe(
      "farta/catalog/hero-desktop",
    );
  });

  it("rejects malformed or incomplete media manifests", () => {
    expect(() => parseDevelopmentSeedManifest("{}")).toThrow(
      /manifest is invalid/,
    );
    expect(() =>
      parseDevelopmentSeedManifest(
        validManifest.replace(
          "farta/catalog/tee-black",
          "https://example.com/image.png",
        ),
      ),
    ).toThrow(/manifest is invalid/);
  });

  it("refuses records outside the selected actor namespace", () => {
    const owned = {
      _id: { toString: () => "resource-id" },
      createdBy: { toString: () => "owner-id" },
      archivedAt: null,
    };
    expect(() =>
      assertSeedOwnership(owned, "owner-id", "product:test"),
    ).not.toThrow();
    expect(() =>
      assertSeedOwnership(owned, "other-owner", "product:test"),
    ).toThrow(/namespace collision/);
    expect(() =>
      assertSeedOwnership(
        { ...owned, archivedAt: new Date() },
        "owner-id",
        "product:test",
      ),
    ).toThrow(/namespace collision/);
  });
});
