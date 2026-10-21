import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// R2 is not enabled on the staging Cloudflare account. Keep authoritative
// catalog requests uncached, but serve build-time SSG entries from the
// read-only Static Assets incremental cache. Cache interception avoids loading
// NextServer for static auth/account shells on every request. Runtime
// revalidation is intentionally unsupported until an approved durable cache
// and queue exist.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
