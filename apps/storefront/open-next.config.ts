import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// R2 is not enabled on the staging Cloudflare account. Catalog requests use
// CATALOG_CACHE_MODE=no-store so the dummy incremental cache is never treated
// as a durable ISR implementation. Enable R2 + a revalidation queue before a
// production traffic launch.
export default defineCloudflareConfig();
