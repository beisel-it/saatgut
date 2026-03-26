import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/server/auth-context";
import { getCalendarItems } from "@/lib/server/calendar-service";
import { serializeGrowingProfile } from "@/lib/server/serializers";

export type McpResourceDefinition = {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
};

const resourceDefinitions: McpResourceDefinition[] = [
  {
    uri: "saatgut://workspace/summary",
    name: "workspace_summary",
    title: "Workspace Summary",
    description: "High-level counts and current workspace context.",
    mimeType: "application/json",
  },
  {
    uri: "saatgut://profiles/active",
    name: "active_profile",
    title: "Active Growing Profile",
    description: "The active frost and phenology profile for calendar planning.",
    mimeType: "application/json",
  },
  {
    uri: "saatgut://calendar/next-14-days",
    name: "calendar_next_14_days",
    title: "Next 14 Days Calendar",
    description: "Upcoming calendar windows and recorded items for the next two weeks.",
    mimeType: "application/json",
  },
];

export function listMcpResources() {
  return resourceDefinitions;
}

export async function readMcpResource(auth: AuthContext, uri: string) {
  if (uri === "saatgut://workspace/summary") {
    const [workspace, speciesCount, varietyCount, seedBatchCount, taskCount] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: auth.workspaceId } }),
      prisma.species.count({ where: { workspaceId: auth.workspaceId } }),
      prisma.variety.count({ where: { workspaceId: auth.workspaceId } }),
      prisma.seedBatch.count({ where: { workspaceId: auth.workspaceId } }),
      prisma.reminderTask.count({ where: { workspaceId: auth.workspaceId } }),
    ]);

    return {
      uri,
      mimeType: "application/json",
      text: JSON.stringify(
        {
          workspace,
          counts: {
            species: speciesCount,
            varieties: varietyCount,
            seedBatches: seedBatchCount,
            reminderTasks: taskCount,
          },
        },
        null,
        2,
      ),
    };
  }

  if (uri === "saatgut://profiles/active") {
    const profile = await prisma.growingProfile.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        isActive: true,
      },
    });

    return {
      uri,
      mimeType: "application/json",
      text: JSON.stringify(profile ? serializeGrowingProfile(profile) : null, null, 2),
    };
  }

  if (uri === "saatgut://calendar/next-14-days") {
    const items = await getCalendarItems({
      workspaceId: auth.workspaceId,
      days: 14,
    });

    return {
      uri,
      mimeType: "application/json",
      text: JSON.stringify(items, null, 2),
    };
  }

  return null;
}
