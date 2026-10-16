import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.e2e-spec.ts"],
    // Each suite boots a full Nest application and synchronizes its own
    // MongoDB indexes. Serial files avoid host-level startup contention while
    // retaining the explicit in-suite concurrency tests.
    fileParallelism: false,
  },
});
