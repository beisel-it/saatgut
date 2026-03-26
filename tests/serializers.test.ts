import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it } from "vitest";

import { serializeSeedBatch } from "@/lib/server/serializers";

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
