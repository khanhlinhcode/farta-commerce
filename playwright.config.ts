import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

function localEnvironmentValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  if (process.env.CI) return undefined;
  try {
    const source = readFileSync(resolve("apps/api/.env"), "utf8");
    const line = source
      .split(/\r?\n/)
      .find((candidate) => candidate.startsWith(`${name}=`));
    const value = line?.slice(name.length + 1).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

const storefrontUrl = process.env.E2E_STOREFRONT_URL ?? "http://localhost:3000";
const adminUrl = process.env.E2E_ADMIN_URL ?? "http://localhost:5173";
const apiUrl = process.env.E2E_API_URL ?? "http://localhost:4000";
const cloudName = localEnvironmentValue("CLOUDINARY_CLOUD_NAME") ?? "";
for (const name of ["E2E_STAFF_EMAIL", "E2E_STAFF_PASSWORD"] as const) {
  const value = localEnvironmentValue(name);
  if (value && !process.env[name]) process.env[name] = value;
}
const serverEnvironment = Object.fromEntries(
  Object.entries(process.env).flatMap(([key, value]) =>
    value === undefined || key.startsWith("E2E_") ? [] : [[key, value]],
  ),
);

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "test-results/browser",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.012,
      stylePath: "tests/browser/visual-snapshot.css",
    },
  },
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}",
  use: {
    baseURL: storefrontUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    colorScheme: "light",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], browserName: "chromium" },
    },
  ],
  webServer: [
    {
      name: "api",
      command: "pnpm --filter @farta/api dev",
      url: `${apiUrl}/api/v1/health/live`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      env: {
        ...serverEnvironment,
        AUTH_LOGIN_LIMIT: "100",
        CART_MERGE_LIMIT: "300",
        CART_MUTATION_LIMIT: "1000",
        CHECKOUT_LIMIT: "300",
        ORDER_LOOKUP_LIMIT: "300",
      },
    },
    {
      name: "storefront",
      command: "pnpm --filter @farta/storefront dev",
      url: storefrontUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      env: {
        ...serverEnvironment,
        API_INTERNAL_URL: apiUrl,
        NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: cloudName,
        NEXT_PUBLIC_INDEXABLE: "false",
        NEXT_PUBLIC_SITE_URL: storefrontUrl,
      },
    },
    {
      name: "admin",
      command:
        "pnpm --filter @farta/admin exec vite --host localhost --port 5173",
      url: adminUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      env: {
        ...serverEnvironment,
        API_PROXY_TARGET: apiUrl,
      },
    },
  ],
});
