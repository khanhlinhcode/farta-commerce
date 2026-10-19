import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

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
const aiUrl = process.env.E2E_AI_URL ?? "http://127.0.0.1:8000";
const storefrontPort = new URL(storefrontUrl).port || "3000";
const adminPort = new URL(adminUrl).port || "5173";
const apiPort = new URL(apiUrl).port || "4000";
const aiPort = new URL(aiUrl).port || "8000";
const storefrontCommand =
  process.env.E2E_STOREFRONT_MODE === "production"
    ? `pnpm --filter @farta/storefront exec next start --port ${storefrontPort}`
    : `pnpm --filter @farta/storefront exec next dev --port ${storefrontPort}`;
const apiCommand =
  process.env.E2E_API_MODE === "production"
    ? "pnpm --filter @farta/api start"
    : "pnpm --filter @farta/api dev";
const reuseExistingServers = process.env.E2E_REUSE_SERVERS === "true";
const aiGatewaySecret = randomBytes(32).toString("base64url");
const aiToolsSecret = randomBytes(32).toString("base64url");
const aiConversationSecret = randomBytes(32).toString("base64url");
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
      command: apiCommand,
      url: `${apiUrl}/api/v1/health/live`,
      reuseExistingServer: reuseExistingServers,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      env: {
        ...serverEnvironment,
        APP_ORIGIN: storefrontUrl,
        ADMIN_ORIGIN: adminUrl,
        API_ORIGIN: apiUrl,
        PORT: apiPort,
        AUTH_LOGIN_LIMIT: "100",
        CART_MERGE_LIMIT: "300",
        CART_MUTATION_LIMIT: "1000",
        CHECKOUT_LIMIT: "300",
        ORDER_LOOKUP_LIMIT: "300",
        AI_ENABLED: "true",
        AI_SERVICE_URL: aiUrl,
        AI_GATEWAY_SHARED_SECRET: aiGatewaySecret,
        AI_TOOLS_SHARED_SECRET: aiToolsSecret,
        AI_CONVERSATION_SECRET: aiConversationSecret,
      },
    },
    {
      name: "ai-service",
      command: `uv run uvicorn app.main:app --host 127.0.0.1 --port ${aiPort}`,
      cwd: "apps/ai-service",
      url: `${aiUrl}/health/live`,
      reuseExistingServer: reuseExistingServers,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      env: {
        ...serverEnvironment,
        AI_APP_ENV: "development",
        AI_ENABLED: "true",
        AI_API_BASE_URL: apiUrl,
        AI_GATEWAY_SHARED_SECRET: aiGatewaySecret,
        AI_TOOLS_SHARED_SECRET: aiToolsSecret,
        AI_GEMINI_ENABLED: "false",
        AI_GROQ_ENABLED: "false",
      },
    },
    {
      name: "storefront",
      command: storefrontCommand,
      url: storefrontUrl,
      reuseExistingServer: reuseExistingServers,
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
      command: `pnpm --filter @farta/admin exec vite --host localhost --port ${adminPort}`,
      url: adminUrl,
      reuseExistingServer: reuseExistingServers,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      env: {
        ...serverEnvironment,
        API_PROXY_TARGET: apiUrl,
      },
    },
  ],
});
