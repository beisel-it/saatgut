import { Prisma, StorageLightExposure, StorageMoistureLevel } from "@prisma/client";

export type SeedBatchWarning = {
  level: "info" | "warning" | "critical";
  code: string;
  title: string;
  detail: string;
};

export function calculateGerminationRate(sampleSize: number, germinatedCount: number): Prisma.Decimal {
  return new Prisma.Decimal(germinatedCount).mul(100).div(sampleSize).toDecimalPlaces(2);
}

export function buildSeedBatchWarnings(input: {
  harvestYear: number | null;
  storageLocation: string | null;
  storageTemperatureC: Prisma.Decimal | null;
  storageHumidityPercent: number | null;
  storageLightExposure: StorageLightExposure | null;
  storageMoistureLevel: StorageMoistureLevel | null;
  latestGerminationRate: Prisma.Decimal | null;
  latestGerminationTestedAt: Date | null;
  now?: Date;
}): SeedBatchWarning[] {
  const warnings: SeedBatchWarning[] = [];
  const now = input.now ?? new Date();

  if (!input.storageLocation) {
    warnings.push({
      level: "warning",
      code: "STORAGE_LOCATION_MISSING",
      title: "Storage location missing",
      detail: "Record where the batch is stored so quality assumptions stay explicit.",
    });
  }

  if (input.storageTemperatureC && input.storageTemperatureC.greaterThan(18)) {
    warnings.push({
      level: "critical",
      code: "STORAGE_TOO_WARM",
      title: "Storage temperature is warm",
      detail: `Recorded storage temperature ${input.storageTemperatureC.toString()}°C is high for long-term seed viability.`,
    });
  } else if (input.storageTemperatureC && input.storageTemperatureC.greaterThan(12)) {
    warnings.push({
      level: "warning",
      code: "STORAGE_TEMPERATURE_ELEVATED",
      title: "Storage temperature is elevated",
      detail: `Recorded storage temperature ${input.storageTemperatureC.toString()}°C should be watched for longer storage.`,
    });
  }

  if ((input.storageHumidityPercent ?? 0) >= 65 || input.storageMoistureLevel === StorageMoistureLevel.HUMID) {
    warnings.push({
      level: "critical",
      code: "STORAGE_TOO_HUMID",
      title: "Storage humidity looks too high",
      detail: "High humidity raises the risk of mold and rapid viability loss.",
    });
  } else if (
    (input.storageHumidityPercent ?? 0) >= 50 ||
    input.storageMoistureLevel === StorageMoistureLevel.MODERATE
  ) {
    warnings.push({
      level: "warning",
      code: "STORAGE_HUMIDITY_ELEVATED",
      title: "Storage humidity is elevated",
      detail: "Dryer storage would be safer for seed longevity.",
    });
  }

  if (input.storageLightExposure === StorageLightExposure.BRIGHT) {
    warnings.push({
      level: "warning",
      code: "STORAGE_BRIGHT",
      title: "Storage light exposure is bright",
      detail: "Move this batch to a darker storage location if possible.",
    });
  }

  if (input.harvestYear) {
    const ageYears = now.getUTCFullYear() - input.harvestYear;

    if (ageYears >= 5) {
      warnings.push({
        level: "critical",
        code: "BATCH_AGING_OUT",
        title: "Batch is ageing out",
        detail: `Harvest year ${input.harvestYear} is ${ageYears} seasons old. Re-test viability before relying on it.`,
      });
    } else if (ageYears >= 3) {
      warnings.push({
        level: "warning",
        code: "BATCH_AGED",
        title: "Batch should be re-checked",
        detail: `Harvest year ${input.harvestYear} is ${ageYears} seasons old. A fresh germination test is recommended.`,
      });
    }
  }

  if (!input.latestGerminationRate || !input.latestGerminationTestedAt) {
    warnings.push({
      level: "warning",
      code: "NO_GERMINATION_TEST",
      title: "No germination test recorded",
      detail: "Record a germination test so sowing density and risk are visible.",
    });
  } else if (input.latestGerminationRate.lessThan(50)) {
    warnings.push({
      level: "critical",
      code: "LOW_GERMINATION_RATE",
      title: "Latest germination rate is poor",
      detail: `Latest test recorded ${input.latestGerminationRate.toString()}% germination. Consider replacing or oversowing this batch.`,
    });
  } else if (input.latestGerminationRate.lessThan(75)) {
    warnings.push({
      level: "warning",
      code: "GERMINATION_RATE_SOFT",
      title: "Latest germination rate is soft",
      detail: `Latest test recorded ${input.latestGerminationRate.toString()}% germination. Plan denser sowing or refresh stock.`,
    });
  }

  return warnings;
}
