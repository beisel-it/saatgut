import { PlantingEventType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildCalendarWindowItems } from "@/lib/server/calendar-service";

describe("buildCalendarWindowItems", () => {
  it("expands frost-relative cultivation windows into the requested horizon", () => {
    const items = buildCalendarWindowItems({
      lastFrostDate: new Date("2026-05-15T00:00:00.000Z"),
      from: new Date("2026-03-15T00:00:00.000Z"),
      days: 21,
      rules: [
        {
          varietyId: "variety_1",
          varietyName: "Black Cherry",
          speciesName: "Tomato",
          sowIndoorsStartWeeks: 8,
          sowIndoorsEndWeeks: 6,
          sowOutdoorsStartWeeks: null,
          sowOutdoorsEndWeeks: null,
          transplantStartWeeks: 1,
          transplantEndWeeks: 3,
        },
      ],
    });

    expect(items).toEqual([
      expect.objectContaining({
        kind: "window",
        type: PlantingEventType.SOW_INDOORS,
        varietyName: "Black Cherry",
        speciesName: "Tomato",
      }),
    ]);
    expect(items[0]?.windowStart).toBe("2026-03-20T00:00:00.000Z");
    expect(items[0]?.windowEnd).toBe("2026-04-03T00:00:00.000Z");
  });

  it("skips cultivation windows outside the requested horizon", () => {
    const items = buildCalendarWindowItems({
      lastFrostDate: new Date("2026-05-15T00:00:00.000Z"),
      from: new Date("2026-01-01T00:00:00.000Z"),
      days: 14,
      rules: [
        {
          varietyId: "variety_1",
          varietyName: "Black Cherry",
          speciesName: "Tomato",
          sowIndoorsStartWeeks: 8,
          sowIndoorsEndWeeks: 6,
          sowOutdoorsStartWeeks: null,
          sowOutdoorsEndWeeks: null,
          transplantStartWeeks: null,
          transplantEndWeeks: null,
        },
      ],
    });

    expect(items).toEqual([]);
  });
});
