import { PlantingEventType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/server/api-error";
import { serializePlantingEvent } from "@/lib/server/serializers";

type WindowDefinition = {
  type: PlantingEventType;
  startOffsetDays: number | null;
  endOffsetDays: number | null;
  label: string;
};

export type CalendarWindowItem = {
  kind: "window";
  type: PlantingEventType;
  label: string;
  varietyId: string;
  varietyName: string;
  speciesName: string;
  windowStart: string;
  windowEnd: string;
  recommendedDate: string;
};

export type CalendarRecordedItem = {
  kind: "recorded";
  date: string;
  event: ReturnType<typeof serializePlantingEvent>;
  varietyName: string;
};

export type CalendarHarvestItem = {
  kind: "harvest";
  type: "HARVEST";
  label: string;
  dateStart: string;
  dateEnd: string | null;
  varietyId: string;
  varietyName: string;
  sourcePlantingEventId: string;
};

export type CalendarItem = CalendarWindowItem | CalendarRecordedItem | CalendarHarvestItem;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function overlaps(windowStart: Date, windowEnd: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return windowStart <= rangeEnd && windowEnd >= rangeStart;
}

function normalizeDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function buildCalendarWindowItems(input: {
  lastFrostDate: Date;
  from: Date;
  days: number;
  rules: Array<{
    varietyId: string;
    varietyName: string;
    speciesName: string;
    sowIndoorsStartWeeks: number | null;
    sowIndoorsEndWeeks: number | null;
    sowOutdoorsStartWeeks: number | null;
    sowOutdoorsEndWeeks: number | null;
    transplantStartWeeks: number | null;
    transplantEndWeeks: number | null;
  }>;
}): CalendarWindowItem[] {
  const rangeStart = normalizeDate(input.from);
  const rangeEnd = addDays(rangeStart, input.days - 1);

  return input.rules.flatMap((rule) => {
    const windows: WindowDefinition[] = [
      {
        type: PlantingEventType.SOW_INDOORS,
        startOffsetDays: rule.sowIndoorsStartWeeks === null ? null : -rule.sowIndoorsStartWeeks * 7,
        endOffsetDays: rule.sowIndoorsEndWeeks === null ? null : -rule.sowIndoorsEndWeeks * 7,
        label: "Start sowing indoors",
      },
      {
        type: PlantingEventType.SOW_OUTDOORS,
        startOffsetDays: rule.sowOutdoorsStartWeeks === null ? null : -rule.sowOutdoorsStartWeeks * 7,
        endOffsetDays: rule.sowOutdoorsEndWeeks === null ? null : -rule.sowOutdoorsEndWeeks * 7,
        label: "Direct sow outdoors",
      },
      {
        type: PlantingEventType.TRANSPLANT,
        startOffsetDays: rule.transplantStartWeeks === null ? null : rule.transplantStartWeeks * 7,
        endOffsetDays: rule.transplantEndWeeks === null ? null : rule.transplantEndWeeks * 7,
        label: "Transplant outside",
      },
    ];

    return windows.flatMap((window) => {
      if (window.startOffsetDays === null || window.endOffsetDays === null) {
        return [];
      }

      const rawStart = addDays(input.lastFrostDate, window.startOffsetDays);
      const rawEnd = addDays(input.lastFrostDate, window.endOffsetDays);
      const windowStart = rawStart <= rawEnd ? normalizeDate(rawStart) : normalizeDate(rawEnd);
      const windowEnd = rawStart <= rawEnd ? normalizeDate(rawEnd) : normalizeDate(rawStart);

      if (!overlaps(windowStart, windowEnd, rangeStart, rangeEnd)) {
        return [];
      }

      const recommendedDate = windowStart < rangeStart ? rangeStart : windowStart;

      return [
        {
          kind: "window" as const,
          type: window.type,
          label: window.label,
          varietyId: rule.varietyId,
          varietyName: rule.varietyName,
          speciesName: rule.speciesName,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          recommendedDate: recommendedDate.toISOString(),
        },
      ];
    });
  });
}

export async function getCalendarItems(input: {
  workspaceId: string;
  from?: Date;
  days: number;
}): Promise<CalendarItem[]> {
  const from = normalizeDate(input.from ?? new Date());
  const to = addDays(from, input.days - 1);

  const activeProfile = await prisma.growingProfile.findFirst({
    where: {
      workspaceId: input.workspaceId,
      isActive: true,
    },
  });

  if (!activeProfile) {
    throw new ApiError(
      409,
      "ACTIVE_PROFILE_REQUIRED",
      "An active growing profile is required before building the calendar.",
    );
  }

  const [rules, plantingEvents] = await Promise.all([
    prisma.cultivationRule.findMany({
      where: {
        variety: {
          workspaceId: input.workspaceId,
        },
      },
      include: {
        variety: {
          include: {
            species: true,
          },
        },
      },
      orderBy: {
        variety: {
          name: "asc",
        },
      },
    }),
    prisma.plantingEvent.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          {
            plannedDate: {
              gte: from,
              lte: to,
            },
          },
          {
            actualDate: {
              gte: from,
              lte: to,
            },
          },
        ],
      },
      include: {
        variety: true,
      },
      orderBy: {
        plannedDate: "asc",
      },
    }),
  ]);

  const windowItems = buildCalendarWindowItems({
    lastFrostDate: activeProfile.lastFrostDate,
    from,
    days: input.days,
    rules: rules.map((rule) => ({
      varietyId: rule.varietyId,
      varietyName: rule.variety.name,
      speciesName: rule.variety.species.commonName,
      sowIndoorsStartWeeks: rule.sowIndoorsStartWeeks,
      sowIndoorsEndWeeks: rule.sowIndoorsEndWeeks,
      sowOutdoorsStartWeeks: rule.sowOutdoorsStartWeeks,
      sowOutdoorsEndWeeks: rule.sowOutdoorsEndWeeks,
      transplantStartWeeks: rule.transplantStartWeeks,
      transplantEndWeeks: rule.transplantEndWeeks,
    })),
  });

  const recordedItems: CalendarRecordedItem[] = plantingEvents.map((event) => ({
    kind: "recorded",
    date: (event.actualDate ?? event.plannedDate ?? event.createdAt).toISOString(),
    event: serializePlantingEvent(event),
    varietyName: event.variety.name,
  }));

  const harvestItems: CalendarHarvestItem[] = plantingEvents.flatMap((event) => {
    const rule = rules.find((candidate) => candidate.varietyId === event.varietyId);
    const sourceDate = event.actualDate ?? event.plannedDate;

    if (!rule || !sourceDate || rule.harvestStartDays === null) {
      return [];
    }

    const harvestStart = addDays(sourceDate, rule.harvestStartDays);
    const harvestEnd = rule.harvestEndDays === null ? null : addDays(sourceDate, rule.harvestEndDays);

    if (harvestStart < from || harvestStart > to) {
      return [];
    }

    return [
      {
        kind: "harvest",
        type: "HARVEST",
        label: "Estimated harvest window",
        dateStart: harvestStart.toISOString(),
        dateEnd: harvestEnd?.toISOString() ?? null,
        varietyId: event.varietyId,
        varietyName: event.variety.name,
        sourcePlantingEventId: event.id,
      },
    ];
  });

  return [...windowItems, ...recordedItems, ...harvestItems].sort((left, right) => {
    const leftDate =
      left.kind === "window"
        ? left.recommendedDate
        : left.kind === "recorded"
          ? left.date
          : left.dateStart;
    const rightDate =
      right.kind === "window"
        ? right.recommendedDate
        : right.kind === "recorded"
          ? right.date
          : right.dateStart;

    return leftDate.localeCompare(rightDate);
  });
}
