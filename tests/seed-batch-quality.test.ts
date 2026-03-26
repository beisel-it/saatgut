import { Prisma, StorageLightExposure, StorageMoistureLevel } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildSeedBatchWarnings,
  calculateGerminationRate,
} from "@/lib/server/seed-batch-quality";

describe("calculateGerminationRate", () => {
  it("calculates a percentage with two decimal places", () => {
    expect(calculateGerminationRate(20, 17).toString()).toBe("85");
    expect(calculateGerminationRate(12, 7).toString()).toBe("58.33");
  });
});

describe("buildSeedBatchWarnings", () => {
  it("flags missing quality evidence and risky storage", () => {
    const warnings = buildSeedBatchWarnings({
      harvestYear: 2020,
      storageLocation: null,
      storageTemperatureC: new Prisma.Decimal("22.0"),
      storageHumidityPercent: 70,
      storageLightExposure: StorageLightExposure.BRIGHT,
      storageMoistureLevel: StorageMoistureLevel.HUMID,
      latestGerminationRate: null,
      latestGerminationTestedAt: null,
      now: new Date("2026-03-26T00:00:00.000Z"),
    });

    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "STORAGE_LOCATION_MISSING",
        "STORAGE_TOO_WARM",
        "STORAGE_TOO_HUMID",
        "STORAGE_BRIGHT",
        "BATCH_AGING_OUT",
        "NO_GERMINATION_TEST",
      ]),
    );
  });

  it("flags low germination even when storage data looks good", () => {
    const warnings = buildSeedBatchWarnings({
      harvestYear: 2025,
      storageLocation: "Cellar shelf",
      storageTemperatureC: new Prisma.Decimal("8.0"),
      storageHumidityPercent: 35,
      storageLightExposure: StorageLightExposure.DARK,
      storageMoistureLevel: StorageMoistureLevel.DRY,
      latestGerminationRate: new Prisma.Decimal("42.50"),
      latestGerminationTestedAt: new Date("2026-02-10T00:00:00.000Z"),
      now: new Date("2026-03-26T00:00:00.000Z"),
    });

    expect(warnings.find((warning) => warning.code === "LOW_GERMINATION_RATE")).toBeTruthy();
    expect(warnings.find((warning) => warning.code === "STORAGE_TOO_WARM")).toBeFalsy();
  });
});
