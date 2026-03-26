import { describe, expect, it } from "vitest";

import { buildTimelineItems } from "@/lib/server/operations-service";

describe("buildTimelineItems", () => {
  it("merges task, journal, and planting records into descending chronology", () => {
    const items = buildTimelineItems({
      reminderTasks: [
        {
          id: "task-1",
          workspaceId: "workspace-1",
          createdByUserId: "user-1",
          assignedUserId: null,
          varietyId: null,
          seedBatchId: null,
          plantingEventId: null,
          title: "Check germination tray",
          details: null,
          dueDate: "2026-03-28T08:00:00.000Z",
          status: "PENDING",
          source: "MANUAL",
          tags: [],
          completedAt: null,
          dismissedAt: null,
          createdAt: "2026-03-26T08:00:00.000Z",
          updatedAt: "2026-03-26T08:00:00.000Z",
        },
      ],
      journalEntries: [
        {
          id: "journal-1",
          workspaceId: "workspace-1",
          varietyId: null,
          seedBatchId: null,
          plantingEventId: null,
          entryType: "OBSERVATION",
          title: "Tomatoes emerging",
          details: null,
          entryDate: "2026-03-29T08:00:00.000Z",
          quantity: null,
          unit: null,
          tags: [],
          createdAt: "2026-03-29T08:00:00.000Z",
          updatedAt: "2026-03-29T08:00:00.000Z",
        },
      ],
      plantingEvents: [
        {
          id: "planting-1",
          workspaceId: "workspace-1",
          varietyId: "variety-1",
          seedBatchId: null,
          growingProfileId: null,
          type: "SOW_INDOORS",
          plannedDate: "2026-03-27T08:00:00.000Z",
          actualDate: null,
          quantityUsed: null,
          locationNote: null,
          notes: null,
          createdAt: "2026-03-27T08:00:00.000Z",
          updatedAt: "2026-03-27T08:00:00.000Z",
        },
      ],
    });

    expect(items.map((item) => item.kind)).toEqual(["journal", "task", "planting"]);
  });
});
