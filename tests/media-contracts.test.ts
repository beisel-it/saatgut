import { describe, expect, it } from "vitest";

import { getOpenApiDocument } from "@/lib/server/openapi";
import { mediaMetadataSchema, seedBatchPhotoMetadataSchema } from "@/lib/server/schemas";

describe("media upload schemas", () => {
  it("accepts optional variety image metadata", () => {
    expect(
      mediaMetadataSchema.parse({
        altText: "Saatgut packet front",
        caption: "Front cover for catalog browsing",
      }),
    ).toEqual({
      altText: "Saatgut packet front",
      caption: "Front cover for catalog browsing",
    });
  });

  it("accepts typed seed batch photo metadata", () => {
    expect(
      seedBatchPhotoMetadataSchema.parse({
        kind: "SEED_BATCH_PACKET",
        altText: "Packet front",
      }),
    ).toEqual({
      kind: "SEED_BATCH_PACKET",
      altText: "Packet front",
    });
  });
});

describe("media OpenAPI paths", () => {
  it("includes variety image, seed batch photo, and media content routes", () => {
    const document = getOpenApiDocument();

    expect(document.paths["/varieties/{varietyId}/image"]).toBeDefined();
    expect(document.paths["/seed-batches/{seedBatchId}/photos"]).toBeDefined();
    expect(document.paths["/seed-batches/{seedBatchId}/photos/{photoId}"]).toBeDefined();
    expect(document.paths["/media/{mediaId}/content"]).toBeDefined();
  });
});
