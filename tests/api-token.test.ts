import { describe, expect, it } from "vitest";

import { createApiToken, hashApiToken } from "@/lib/auth/api-token";

describe("api token helpers", () => {
  it("creates opaque tokens with deterministic hashes", () => {
    const token = createApiToken();

    expect(token.plainTextToken.length).toBeGreaterThan(20);
    expect(token.tokenPrefix).toBe(token.plainTextToken.slice(0, 8));
    expect(token.tokenHash).toBe(hashApiToken(token.plainTextToken));
  });
});
