import {
  ApiTokenScope,
  Prisma,
  ReminderTaskSource,
  ReminderTaskStatus,
  SpeciesCategory,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/server/api-error";
import type { AuthContext } from "@/lib/server/auth-context";
import { getCalendarItems } from "@/lib/server/calendar-service";
import {
  createPlantingEvent,
  listSeedBatches,
  searchVarieties,
} from "@/lib/server/domain-service";
import { createJournalEntry } from "@/lib/server/journal-service";
import {
  createReminderTaskRecord,
  updateReminderTaskStatus,
} from "@/lib/server/operations-service";
import { listMcpPrompts, getMcpPrompt, MCP_PROMPT_POLICY } from "@/lib/server/mcp/prompts";
import { listMcpResources, readMcpResource } from "@/lib/server/mcp/resources";
import {
  calendarQuerySchema,
  journalEntryCreateSchema,
  plantingEventCreateSchema,
  reminderTaskCreateSchema,
} from "@/lib/server/schemas";
import {
  serializeJournalEntry,
  serializePlantingEvent,
  serializeReminderTask,
  serializeSeedBatch,
  serializeVariety,
} from "@/lib/server/serializers";

const MCP_PROTOCOL_VERSION = "2025-06-18";
const MCP_SERVER_NAME = "saatgut-mcp";
const MCP_SERVER_VERSION = "0.1.0";

type JsonRpcId = string | number | null;

const toolCallSchema = z.object({
  name: z.string().trim().min(1),
  arguments: z.record(z.string(), z.unknown()).optional(),
});

const resourceReadSchema = z.object({
  uri: z.string().trim().min(1),
});

const promptGetSchema = z.object({
  name: z.string().trim().min(1),
  arguments: z.record(z.string(), z.string()).optional(),
});

const completeTaskSchema = z.object({
  taskId: z.string().cuid(),
  dry_run: z.boolean().default(false),
});

function toAuditJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function formatStructuredContent(value: unknown) {
  return [
    {
      type: "text",
      text: JSON.stringify(value, null, 2),
    },
  ];
}

function toProtocolError(error: unknown) {
  if (error instanceof z.ZodError) {
    return {
      code: -32602,
      message: "Invalid params",
      data: error.flatten(),
    };
  }

  if (error instanceof ApiError) {
    return {
      code: -32000,
      message: error.message,
      data: {
        code: error.code,
        details: error.details ?? null,
      },
    };
  }

  return {
    code: -32603,
    message: "Internal error",
  };
}

async function recordMcpToolAudit(
  auth: AuthContext,
  input: {
    toolName: string;
    args: Record<string, unknown>;
    status: "success" | "dry_run" | "error";
    error?: { message: string; code?: string };
  },
) {
  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      actorUserId: auth.userId,
      action: "mcp.tool.call",
      entityType: "McpTool",
      entityId: input.toolName,
      payload: toAuditJson({
        toolName: input.toolName,
        authMethod: auth.authMethod,
        status: input.status,
        args: input.args,
        error: input.error ?? null,
      }),
    },
  });
}

async function assertWorkspaceReferences(
  auth: AuthContext,
  ids: {
    varietyId?: string | null;
    seedBatchId?: string | null;
    growingProfileId?: string | null;
    plantingEventId?: string | null;
    assignedUserId?: string | null;
    taskId?: string | null;
  },
) {
  if (ids.varietyId) {
    const variety = await prisma.variety.findFirst({
      where: { id: ids.varietyId, workspaceId: auth.workspaceId },
    });

    if (!variety) {
      throw new ApiError(404, "VARIETY_NOT_FOUND", "Variety was not found in this workspace.");
    }
  }

  if (ids.seedBatchId) {
    const seedBatch = await prisma.seedBatch.findFirst({
      where: { id: ids.seedBatchId, workspaceId: auth.workspaceId },
    });

    if (!seedBatch) {
      throw new ApiError(404, "SEED_BATCH_NOT_FOUND", "Seed batch was not found in this workspace.");
    }
  }

  if (ids.growingProfileId) {
    const profile = await prisma.growingProfile.findFirst({
      where: { id: ids.growingProfileId, workspaceId: auth.workspaceId },
    });

    if (!profile) {
      throw new ApiError(404, "GROWING_PROFILE_NOT_FOUND", "Growing profile was not found in this workspace.");
    }
  }

  if (ids.plantingEventId) {
    const event = await prisma.plantingEvent.findFirst({
      where: { id: ids.plantingEventId, workspaceId: auth.workspaceId },
    });

    if (!event) {
      throw new ApiError(404, "PLANTING_EVENT_NOT_FOUND", "Planting event was not found in this workspace.");
    }
  }

  if (ids.assignedUserId) {
    const membership = await prisma.membership.findFirst({
      where: { workspaceId: auth.workspaceId, userId: ids.assignedUserId },
    });

    if (!membership) {
      throw new ApiError(404, "ASSIGNED_USER_NOT_FOUND", "Assigned user is not part of this workspace.");
    }
  }

  if (ids.taskId) {
    const task = await prisma.reminderTask.findFirst({
      where: { id: ids.taskId, workspaceId: auth.workspaceId },
    });

    if (!task) {
      throw new ApiError(404, "REMINDER_TASK_NOT_FOUND", "Reminder task was not found in this workspace.");
    }
  }
}

type McpTool = {
  name: string;
  title: string;
  description: string;
  scope: ApiTokenScope;
  inputSchema: Record<string, unknown>;
  annotations: {
    title: string;
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  execute: (auth: AuthContext, args: Record<string, unknown>) => Promise<unknown>;
};

const mcpTools: McpTool[] = [
  {
    name: "calendar_preview",
    title: "Calendar Preview",
    description: "Preview calendar windows and recorded items for the active growing profile.",
    scope: ApiTokenScope.READ,
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", format: "date-time" },
        days: { type: "integer", minimum: 1, maximum: 60, default: 14 },
      },
      additionalProperties: false,
    },
    annotations: {
      title: "Calendar Preview",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async (auth, args) => {
      const input = calendarQuerySchema.parse(args);
      return getCalendarItems({
        workspaceId: auth.workspaceId,
        from: input.from ? new Date(input.from) : undefined,
        days: input.days,
      });
    },
  },
  {
    name: "seed_batch_status",
    title: "Seed Batch Status",
    description: "Read stock, germination, and storage warning state for a seed batch.",
    scope: ApiTokenScope.READ,
    inputSchema: {
      type: "object",
      required: ["seedBatchId"],
      properties: {
        seedBatchId: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: {
      title: "Seed Batch Status",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async (auth, args) => {
      const input = z.object({ seedBatchId: z.string().cuid() }).parse(args);
      const seedBatches = await listSeedBatches(auth);
      const seedBatch = seedBatches.find((candidate) => candidate.id === input.seedBatchId);

      if (!seedBatch) {
        throw new ApiError(404, "SEED_BATCH_NOT_FOUND", "Seed batch was not found in this workspace.");
      }

      return {
        seedBatch: serializeSeedBatch(seedBatch),
        latestGerminationTest: seedBatch.germinationTests?.[0] ?? null,
        warningCount: seedBatch.storageWarnings?.length ?? 0,
      };
    },
  },
  {
    name: "list_varieties",
    title: "List Varieties",
    description: "Search and filter the variety catalog for the authenticated workspace.",
    scope: ApiTokenScope.READ,
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string" },
        speciesId: { type: "string" },
        category: { type: "string" },
        heirloom: { type: "boolean" },
        tag: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: {
      title: "List Varieties",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async (auth, args) => {
      const input = z
        .object({
          q: z.string().trim().min(1).optional(),
          speciesId: z.string().cuid().optional(),
          category: z.nativeEnum(SpeciesCategory).optional(),
          heirloom: z.boolean().optional(),
          tag: z.string().trim().min(1).optional(),
        })
        .parse(args);

      const items = await searchVarieties(auth, input);
      return { items: items.map(serializeVariety) };
    },
  },
  {
    name: "get_variety",
    title: "Get Variety",
    description: "Read the full catalog record for a single variety.",
    scope: ApiTokenScope.READ,
    inputSchema: {
      type: "object",
      required: ["varietyId"],
      properties: {
        varietyId: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: {
      title: "Get Variety",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async (auth, args) => {
      const input = z.object({ varietyId: z.string().cuid() }).parse(args);
      const variety = await prisma.variety.findFirst({
        where: {
          id: input.varietyId,
          workspaceId: auth.workspaceId,
        },
        include: {
          species: true,
          synonyms: true,
          cultivationRule: true,
        },
      });

      if (!variety) {
        throw new ApiError(404, "VARIETY_NOT_FOUND", "Variety was not found in this workspace.");
      }

      return { variety: serializeVariety(variety) };
    },
  },
  {
    name: "create_planting_event",
    title: "Create Planting Event",
    description: "Create a sowing or transplant event, with dry-run support for review-first agents.",
    scope: ApiTokenScope.WRITE,
    inputSchema: {
      type: "object",
      required: ["varietyId", "type"],
      properties: {
        varietyId: { type: "string" },
        seedBatchId: { type: ["string", "null"] },
        growingProfileId: { type: ["string", "null"] },
        type: { type: "string" },
        plannedDate: { type: ["string", "null"], format: "date-time" },
        actualDate: { type: ["string", "null"], format: "date-time" },
        quantityUsed: { type: ["number", "null"] },
        locationNote: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
        dry_run: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
    annotations: {
      title: "Create Planting Event",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    execute: async (auth, args) => {
      const input = plantingEventCreateSchema
        .extend({ dry_run: z.boolean().default(false) })
        .parse(args);

      if (input.dry_run) {
        await assertWorkspaceReferences(auth, {
          varietyId: input.varietyId,
          seedBatchId: input.seedBatchId,
          growingProfileId: input.growingProfileId,
        });

        return {
          dryRun: true,
          action: "create_planting_event",
          plantingEvent: input,
        };
      }

      const plantingEvent = await createPlantingEvent(auth, input);
      return {
        dryRun: false,
        plantingEvent: serializePlantingEvent(plantingEvent),
      };
    },
  },
  {
    name: "log_observation",
    title: "Log Observation",
    description: "Create a planting journal observation, note, or seed-saving record.",
    scope: ApiTokenScope.WRITE,
    inputSchema: {
      type: "object",
      required: ["entryType", "title", "entryDate"],
      properties: {
        varietyId: { type: ["string", "null"] },
        seedBatchId: { type: ["string", "null"] },
        plantingEventId: { type: ["string", "null"] },
        entryType: { type: "string" },
        title: { type: "string" },
        details: { type: ["string", "null"] },
        entryDate: { type: "string", format: "date-time" },
        quantity: { type: ["number", "null"] },
        unit: { type: ["string", "null"] },
        tags: { type: "array", items: { type: "string" } },
        dry_run: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
    annotations: {
      title: "Log Observation",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    execute: async (auth, args) => {
      const input = journalEntryCreateSchema
        .extend({ dry_run: z.boolean().default(false) })
        .parse(args);

      if (input.dry_run) {
        await assertWorkspaceReferences(auth, {
          varietyId: input.varietyId,
          seedBatchId: input.seedBatchId,
          plantingEventId: input.plantingEventId,
        });

        return {
          dryRun: true,
          action: "log_observation",
          journalEntry: input,
        };
      }

      const entry = await createJournalEntry(auth, input);
      return {
        dryRun: false,
        journalEntry: serializeJournalEntry(entry),
      };
    },
  },
  {
    name: "create_task",
    title: "Create Task",
    description: "Create a reminder task linked to the seed-bank workflow.",
    scope: ApiTokenScope.WRITE,
    inputSchema: {
      type: "object",
      required: ["title", "dueDate"],
      properties: {
        assignedUserId: { type: ["string", "null"] },
        varietyId: { type: ["string", "null"] },
        seedBatchId: { type: ["string", "null"] },
        plantingEventId: { type: ["string", "null"] },
        title: { type: "string" },
        details: { type: ["string", "null"] },
        dueDate: { type: "string", format: "date-time" },
        source: { type: "string", default: ReminderTaskSource.MANUAL },
        tags: { type: "array", items: { type: "string" } },
        dry_run: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
    annotations: {
      title: "Create Task",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    execute: async (auth, args) => {
      const input = reminderTaskCreateSchema
        .extend({ dry_run: z.boolean().default(false) })
        .parse(args);

      if (input.dry_run) {
        await assertWorkspaceReferences(auth, {
          assignedUserId: input.assignedUserId,
          varietyId: input.varietyId,
          seedBatchId: input.seedBatchId,
          plantingEventId: input.plantingEventId,
        });

        return {
          dryRun: true,
          action: "create_task",
          reminderTask: input,
        };
      }

      const task = await createReminderTaskRecord(auth, input);
      return {
        dryRun: false,
        reminderTask: serializeReminderTask(task),
      };
    },
  },
  {
    name: "complete_task",
    title: "Complete Task",
    description: "Mark a reminder task as completed, with dry-run preview support.",
    scope: ApiTokenScope.WRITE,
    inputSchema: {
      type: "object",
      required: ["taskId"],
      properties: {
        taskId: { type: "string" },
        dry_run: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
    annotations: {
      title: "Complete Task",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    execute: async (auth, args) => {
      const input = completeTaskSchema.parse(args);

      if (input.dry_run) {
        await assertWorkspaceReferences(auth, { taskId: input.taskId });
        return {
          dryRun: true,
          action: "complete_task",
          taskId: input.taskId,
          targetStatus: ReminderTaskStatus.COMPLETED,
        };
      }

      const task = await updateReminderTaskStatus(auth, input.taskId, ReminderTaskStatus.COMPLETED);
      return {
        dryRun: false,
        reminderTask: serializeReminderTask(task),
      };
    },
  },
];

function listToolMetadata() {
  return mcpTools.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
  }));
}

async function executeTool(auth: AuthContext, input: z.infer<typeof toolCallSchema>) {
  const tool = mcpTools.find((candidate) => candidate.name === input.name);

  if (!tool) {
    throw new ApiError(404, "MCP_TOOL_NOT_FOUND", "MCP tool was not found.", {
      toolName: input.name,
    });
  }

  if (tool.scope === ApiTokenScope.WRITE && !auth.tokenScopes?.includes(ApiTokenScope.ADMIN) && !auth.tokenScopes?.includes(ApiTokenScope.WRITE)) {
    throw new ApiError(403, "API_TOKEN_SCOPE_DENIED", "API token does not grant this capability.", {
      requiredScope: ApiTokenScope.WRITE,
    });
  }

  const args = input.arguments ?? {};

  try {
    const result = await tool.execute(auth, args);
    const status = typeof result === "object" && result && "dryRun" in result && result.dryRun ? "dry_run" : "success";
    await recordMcpToolAudit(auth, { toolName: tool.name, args, status });

    return {
      content: formatStructuredContent(result),
      structuredContent: result,
      isError: false,
    };
  } catch (error) {
    const apiError = error instanceof ApiError ? error : undefined;
    await recordMcpToolAudit(auth, {
      toolName: tool.name,
      args,
      status: "error",
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
        code: apiError?.code,
      },
    });
    throw error;
  }
}

export function getMcpEndpointMetadata() {
  return {
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
    protocolVersion: MCP_PROTOCOL_VERSION,
    transport: "streamable-http",
    endpoint: `${env.APP_URL}/api/v1/mcp`,
    auth: "Bearer API token only",
    allowedOrigins: env.MCP_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    notes: [
      "The MCP endpoint is API-token only.",
      "Browser-origin requests must match MCP_ALLOWED_ORIGINS.",
      "Write tools support dry_run=true and create a dedicated audit log entry per call.",
    ],
  };
}

export async function handleMcpRequest(
  auth: AuthContext,
  body: unknown,
): Promise<{ status: number; body?: unknown }> {
  const request = z
    .object({
      jsonrpc: z.literal("2.0"),
      id: z.union([z.string(), z.number(), z.null()]).optional(),
      method: z.string().trim().min(1),
      params: z.unknown().optional(),
    })
    .parse(body);

  const id: JsonRpcId = request.id ?? null;

  try {
    switch (request.method) {
      case "initialize":
        return {
          status: 200,
          body: {
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: MCP_PROTOCOL_VERSION,
              capabilities: {
                tools: { listChanged: false },
                resources: { listChanged: false, subscribe: false },
                prompts: { listChanged: false },
              },
              serverInfo: {
                name: MCP_SERVER_NAME,
                version: MCP_SERVER_VERSION,
              },
              instructions: MCP_PROMPT_POLICY,
            },
          },
        };
      case "ping":
        return {
          status: 200,
          body: {
            jsonrpc: "2.0",
            id,
            result: {},
          },
        };
      case "notifications/initialized":
        return { status: 202 };
      case "tools/list":
        return {
          status: 200,
          body: {
            jsonrpc: "2.0",
            id,
            result: {
              tools: listToolMetadata(),
            },
          },
        };
      case "tools/call": {
        const params = toolCallSchema.parse(request.params ?? {});
        const result = await executeTool(auth, params);
        return {
          status: 200,
          body: {
            jsonrpc: "2.0",
            id,
            result,
          },
        };
      }
      case "resources/list":
        return {
          status: 200,
          body: {
            jsonrpc: "2.0",
            id,
            result: {
              resources: listMcpResources(),
            },
          },
        };
      case "resources/read": {
        const params = resourceReadSchema.parse(request.params ?? {});
        const resource = await readMcpResource(auth, params.uri);

        if (!resource) {
          throw new ApiError(404, "MCP_RESOURCE_NOT_FOUND", "MCP resource was not found.", {
            uri: params.uri,
          });
        }

        return {
          status: 200,
          body: {
            jsonrpc: "2.0",
            id,
            result: {
              contents: [resource],
            },
          },
        };
      }
      case "prompts/list":
        return {
          status: 200,
          body: {
            jsonrpc: "2.0",
            id,
            result: {
              prompts: listMcpPrompts(),
            },
          },
        };
      case "prompts/get": {
        const params = promptGetSchema.parse(request.params ?? {});
        const prompt = getMcpPrompt(params.name, params.arguments);

        if (!prompt) {
          throw new ApiError(404, "MCP_PROMPT_NOT_FOUND", "MCP prompt was not found.", {
            promptName: params.name,
          });
        }

        return {
          status: 200,
          body: {
            jsonrpc: "2.0",
            id,
            result: prompt,
          },
        };
      }
      default:
        return {
          status: 200,
          body: {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32601,
              message: "Method not found",
            },
          },
        };
    }
  } catch (error) {
    return {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        error: toProtocolError(error),
      },
    };
  }
}
