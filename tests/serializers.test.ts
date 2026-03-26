import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it } from "vitest";

import {
  serializeApiToken,
  serializeMediaAsset,
  serializePasskeyCredential,
  serializeSpecies,
  serializeVariety,
  serializeSeedBatch,
  serializeUser,
  serializeWorkspaceMember,
} from "@/lib/server/serializers";

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

describe("guidance serializers", () => {
  it("keeps horticultural guidance fields JSON-safe on species and varieties", () => {
    const species = serializeSpecies({
      id: "species_1",
      workspaceId: "workspace_1",
      commonName: "Tomate",
      latinName: "Solanum lycopersicum",
      category: "VEGETABLE",
      germinationNotes: "24C and evenly moist compost.",
      preferredLocation: "Full sun with shelter from wind.",
      companionPlantingNotes: "Works well with basil and tagetes.",
      notes: null,
      createdAt: new Date("2026-03-26T00:00:00.000Z"),
      updatedAt: new Date("2026-03-26T00:00:00.000Z"),
    });

    const variety = serializeVariety({
      id: "variety_1",
      workspaceId: "workspace_1",
      speciesId: "species_1",
      name: "Berner Rose",
      description: null,
      heirloom: true,
      tags: ["tomato"],
      germinationNotes: "Bottom heat speeds emergence.",
      preferredLocation: "Greenhouse or very warm bed.",
      companionPlantingNotes: "Avoid potatoes nearby.",
      notes: null,
      createdAt: new Date("2026-03-26T00:00:00.000Z"),
      updatedAt: new Date("2026-03-26T00:00:00.000Z"),
      species: {
        id: "species_1",
        commonName: "Tomate",
        latinName: "Solanum lycopersicum",
        category: "VEGETABLE",
        germinationNotes: "24C and evenly moist compost.",
        preferredLocation: "Full sun with shelter from wind.",
        companionPlantingNotes: "Works well with basil and tagetes.",
      },
      companionLinksAsPrimary: [
        {
          primaryVarietyId: "variety_1",
          secondaryVariety: {
            id: "variety_2",
            name: "Genovese",
            speciesId: "species_2",
            heirloom: false,
            tags: ["herb"],
            species: {
              id: "species_2",
              commonName: "Basilikum",
              latinName: "Ocimum basilicum",
              category: "HERB",
            },
            mediaAssets: [],
          },
          createdAt: new Date("2026-03-27T00:00:00.000Z"),
          updatedAt: new Date("2026-03-27T12:00:00.000Z"),
        },
      ],
    });

    expect(species.germinationNotes).toBe("24C and evenly moist compost.");
    expect(species.preferredLocation).toBe("Full sun with shelter from wind.");
    expect(variety.companionPlantingNotes).toBe("Avoid potatoes nearby.");
    expect(variety.species?.companionPlantingNotes).toBe("Works well with basil and tagetes.");
    expect(variety.companionVarieties).toEqual([
      {
        id: "variety_2",
        name: "Genovese",
        speciesId: "species_2",
        heirloom: false,
        tags: ["herb"],
        representativeImage: null,
        species: {
          id: "species_2",
          commonName: "Basilikum",
          latinName: "Ocimum basilicum",
          category: "HERB",
        },
        linkedAt: "2026-03-27T00:00:00.000Z",
        updatedAt: "2026-03-27T12:00:00.000Z",
      },
    ]);
  });
});

describe("serializeMediaAsset", () => {
  it("emits same-origin content URLs for stored media", () => {
    const asset = serializeMediaAsset({
      id: "media_1",
      kind: "SEED_BATCH_PACKET",
      originalFilename: "packet.jpg",
      mimeType: "image/jpeg",
      byteSize: 1024,
      altText: "Packet front",
      caption: "Harvest 2025",
      createdAt: new Date("2026-03-26T00:00:00.000Z"),
      updatedAt: new Date("2026-03-26T00:00:00.000Z"),
    });

    expect(asset.contentUrl).toBe("/api/v1/media/media_1/content");
    expect(asset.mimeType).toBe("image/jpeg");
    expect(asset.byteSize).toBe(1024);
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

describe("serializeWorkspaceMember", () => {
  it("keeps membership output JSON-safe without exposing password material", () => {
    const member = serializeWorkspaceMember({
      role: "MEMBER",
      createdAt: new Date("2026-03-26T00:00:00.000Z"),
      user: {
        id: "user_1",
        email: "grower@example.com",
        isActive: true,
        role: "MEMBER",
        passwordHash: "secret",
        createdAt: new Date("2026-03-26T00:00:00.000Z"),
        updatedAt: new Date("2026-03-26T00:00:00.000Z"),
      } as never,
    });

    expect(member.createdAt).toBe("2026-03-26T00:00:00.000Z");
    expect(member.user).not.toHaveProperty("passwordHash");
  });
});

describe("serializePasskeyCredential", () => {
  it("serializes passkey metadata without exposing public keys", () => {
    const passkey = serializePasskeyCredential({
      id: "passkey_1",
      deviceType: "MULTI_DEVICE",
      backedUp: true,
      transports: ["internal"],
      lastUsedAt: new Date("2026-03-26T12:00:00.000Z"),
      createdAt: new Date("2026-03-26T00:00:00.000Z"),
      updatedAt: new Date("2026-03-26T00:00:00.000Z"),
      publicKey: Buffer.from("secret"),
    } as never);

    expect(passkey.lastUsedAt).toBe("2026-03-26T12:00:00.000Z");
    expect(passkey.credentialPreview).toBeNull();
    expect(passkey.canRemove).toBe(true);
    expect(passkey.removalBlockedReason).toBeNull();
    expect(passkey).not.toHaveProperty("publicKey");
  });
});
