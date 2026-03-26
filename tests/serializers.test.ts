import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it } from "vitest";

import { serializeApiToken, serializeSeedBatch, serializeUser } from "@/lib/server/serializers";

describe("serializeSeedBatch", () => {
  it("converts Prisma decimals to JSON-safe strings", () => {
    const payload = serializeSeedBatch({
      id: "seed_batch_1",
      workspaceId: "workspace_1",
      varietyId: "variety_1",
      source: "Saved seed",
      harvestYear: 2025,
      quantity: new Decimal("42.50"),
      unit: "SEEDS",
      storageLocation: "Pantry",
      notes: null,
      createdAt: new Date("2026-03-26T00:00:00.000Z"),
      updatedAt: new Date("2026-03-26T00:00:00.000Z"),
    });

    expect(payload.quantity).toBe("42.5");
  });
});

describe("sensitive serializer output", () => {
  it("does not expose password hashes or token hashes", () => {
    const user = serializeUser({
      id: "user_1",
      email: "grower@example.com",
      isActive: true,
      role: "ADMIN",
      passwordHash: "secret",
      createdAt: new Date("2026-03-26T00:00:00.000Z"),
      updatedAt: new Date("2026-03-26T00:00:00.000Z"),
    } as never);

    const token = serializeApiToken({
      id: "token_1",
      workspaceId: "workspace_1",
      createdByUserId: "user_1",
      name: "ops",
      tokenPrefix: "abcd1234",
      tokenHash: "secret",
      scopes: ["READ"],
      rateLimitPerMinute: 10,
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date("2026-03-26T00:00:00.000Z"),
      updatedAt: new Date("2026-03-26T00:00:00.000Z"),
    } as never);

    expect(user).not.toHaveProperty("passwordHash");
    expect(token).not.toHaveProperty("tokenHash");
  });
});
