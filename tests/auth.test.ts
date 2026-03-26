import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

describe("password auth helpers", () => {
  it("hashes and verifies a password", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    await expect(
      verifyPassword("correct horse battery staple", passwordHash),
    ).resolves.toBe(true);
    await expect(verifyPassword("wrong password", passwordHash)).resolves.toBe(false);
  });
});

describe("session token helpers", () => {
  it("creates and verifies a signed session token", () => {
    const token = createSessionToken({
      userId: "user_123",
      workspaceId: "workspace_123",
      role: "ADMIN",
      membershipRole: "OWNER",
    });

    const payload = verifySessionToken(token);

    expect(payload).toMatchObject({
      userId: "user_123",
      workspaceId: "workspace_123",
      role: "ADMIN",
      membershipRole: "OWNER",
    });
  });

  it("rejects expired tokens", () => {
    const token = createSessionToken(
      {
        userId: "user_123",
        workspaceId: "workspace_123",
        role: "ADMIN",
        membershipRole: "OWNER",
      },
      0,
    );

    expect(verifySessionToken(token, 1000 * 60 * 60 * 24 * 8)).toBeNull();
  });
});
