import { describe, expect, it } from "vitest";

import { buildDatabaseOptions } from "./database.module";

describe("buildDatabaseOptions", () => {
  const uri = "mongodb://127.0.0.1:27017/farta?replicaSet=rs0";

  it("uses a direct replica-set connection only in development", () => {
    expect(buildDatabaseOptions("development", uri)).toMatchObject({
      uri,
      directConnection: true,
      autoIndex: true,
    });
  });

  it.each(["test", "staging", "production"] as const)(
    "does not inject development connection behavior into %s",
    (appEnvironment) => {
      const options = buildDatabaseOptions(appEnvironment, uri);

      expect(options).not.toHaveProperty("directConnection");
      expect(options.autoIndex).toBe(appEnvironment === "test");
    },
  );
});
