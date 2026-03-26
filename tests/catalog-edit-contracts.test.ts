import { describe, expect, it } from "vitest";

import {
  seedBatchUpdateSchema,
  speciesUpdateSchema,
  varietyUpdateSchema,
} from "@/lib/server/schemas";
import { getOpenApiDocument } from "@/lib/server/openapi";

describe("catalog edit schemas", () => {
  it("accepts partial species updates", () => {
    expect(
      speciesUpdateSchema.parse({
        commonName: "Paprika",
        preferredLocation: "Warmer, windgeschuetzter Platz",
      }),
    ).toEqual({
      commonName: "Paprika",
      preferredLocation: "Warmer, windgeschuetzter Platz",
    });
  });

  it("accepts partial variety updates with synonym replacement", () => {
    expect(
      varietyUpdateSchema.parse({
        tags: ["qa", "editable"],
        synonyms: ["Sweet Pepper"],
        companionPlantingNotes: "Basilikum and Tagetes work well nearby.",
      }),
    ).toEqual({
      tags: ["qa", "editable"],
      synonyms: ["Sweet Pepper"],
      companionPlantingNotes: "Basilikum and Tagetes work well nearby.",
    });
  });

  it("rejects seed batch quantity edits through the metadata patch contract", () => {
    expect(() =>
      seedBatchUpdateSchema.parse({
        quantity: 10,
      }),
    ).toThrow();
  });
});

describe("catalog edit OpenAPI paths", () => {
  it("includes catalog patch and delete paths", () => {
    const document = getOpenApiDocument();

    expect(document.paths["/species/{speciesId}"]).toBeDefined();
    expect(document.paths["/varieties/{varietyId}"]).toBeDefined();
    expect(document.paths["/seed-batches/{seedBatchId}"]).toBeDefined();
  });
});
