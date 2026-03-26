import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/server/api-error";
import { assertRateLimit } from "@/lib/server/rate-limit";

describe("assertRateLimit", () => {
  it("allows requests until the configured limit is exhausted", () => {
    expect(assertRateLimit({ key: "test-a", limit: 2, now: 0 }).remaining).toBe(1);
    expect(assertRateLimit({ key: "test-a", limit: 2, now: 1 }).remaining).toBe(0);
  });

  it("throws an API error after the limit is exceeded", () => {
    assertRateLimit({ key: "test-b", limit: 1, now: 0 });

    expect(() => assertRateLimit({ key: "test-b", limit: 1, now: 1 })).toThrowError(ApiError);
  });
});
