import { describe, expect, it } from "vitest";

import {
  cultivationRuleUpdateSchema,
  growingProfileUpdateSchema,
  plantingEventUpdateSchema,
} from "@/lib/server/schemas";
import { getOpenApiDocument } from "@/lib/server/openapi";

describe("cross-app edit schemas", () => {
  it("accepts partial growing profile updates", () => {
    expect(
      growingProfileUpdateSchema.parse({
        notes: "Updated local notes",
        isActive: true,
      }),
    ).toEqual({
      notes: "Updated local notes",
      isActive: true,
    });
  });

  it("accepts partial cultivation rule updates", () => {
    expect(
      cultivationRuleUpdateSchema.parse({
        harvestStartDays: 90,
        harvestEndDays: 120,
      }),
    ).toEqual({
      harvestStartDays: 90,
      harvestEndDays: 120,
    });
  });

  it("accepts planting event stock-affecting updates", () => {
    expect(
      plantingEventUpdateSchema.parse({
        seedBatchId: "ckprofile12345678901234567",
        quantityUsed: 12,
      }),
    ).toEqual({
      seedBatchId: "ckprofile12345678901234567",
      quantityUsed: 12,
    });
  });
});

describe("cross-app edit OpenAPI paths", () => {
  it("includes profile, rule, and planting patch/delete paths", () => {
    const document = getOpenApiDocument();

    expect(document.paths["/profiles/{profileId}"]).toBeDefined();
    expect(document.paths["/cultivation-rules/{ruleId}"]).toBeDefined();
    expect(document.paths["/plantings/{plantingId}"]).toBeDefined();
  });
});
