import { describe, expect, it } from "vitest";

import { assertStagingIndexEnvironment } from "./create-declared-indexes";

describe("staging declared-index gate", () => {
  it("accepts staging only with the explicit one-time gate", () => {
    expect(() =>
      assertStagingIndexEnvironment("staging", "CREATE_DECLARED_INDEXES_V1"),
    ).not.toThrow();
  });

  it.each(["development", "test", "production", undefined])(
    "refuses environment %s",
    (environment) => {
      expect(() =>
        assertStagingIndexEnvironment(
          environment,
          "CREATE_DECLARED_INDEXES_V1",
        ),
      ).toThrow("APP_ENV=staging");
    },
  );

  it("refuses a missing or incorrect gate", () => {
    expect(() => assertStagingIndexEnvironment("staging", undefined)).toThrow(
      "explicit one-time gate",
    );
    expect(() =>
      assertStagingIndexEnvironment("staging", "wrong-gate"),
    ).toThrow("explicit one-time gate");
  });
});
