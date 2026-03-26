import { describe, expect, it } from "vitest";
import { ApiTokenScope } from "@prisma/client";

import { handleMcpRequest } from "@/lib/server/mcp/server";

const auth = {
  userId: "user_123",
  workspaceId: "workspace_123",
  role: "ADMIN" as const,
  membershipRole: "OWNER" as const,
  authMethod: "api_token" as const,
  tokenScopes: [ApiTokenScope.READ, ApiTokenScope.WRITE, ApiTokenScope.ADMIN],
};

describe("handleMcpRequest", () => {
  it("returns initialize metadata", async () => {
    const response = await handleMcpRequest(auth, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-06-18",
        serverInfo: {
          name: "saatgut-mcp",
        },
      },
    });
  });

  it("lists tools with write/read annotations", async () => {
    const response = await handleMcpRequest(auth, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    const body = response.body as { result: { tools: Array<{ name: string; annotations: { readOnlyHint: boolean } }> } };
    const tools = body.result.tools;

    expect(tools.some((tool) => tool.name === "calendar_preview" && tool.annotations.readOnlyHint)).toBe(true);
    expect(tools.some((tool) => tool.name === "create_task" && !tool.annotations.readOnlyHint)).toBe(true);
  });

  it("returns prompt definitions", async () => {
    const response = await handleMcpRequest(auth, {
      jsonrpc: "2.0",
      id: 3,
      method: "prompts/list",
    });

    expect(response.body).toMatchObject({
      jsonrpc: "2.0",
      id: 3,
      result: {
        prompts: expect.arrayContaining([
          expect.objectContaining({ name: "weekly_plan" }),
          expect.objectContaining({ name: "seed_quality_review" }),
        ]),
      },
    });
  });

  it("returns not found for unknown methods", async () => {
    const response = await handleMcpRequest(auth, {
      jsonrpc: "2.0",
      id: 4,
      method: "unknown/method",
    });

    expect(response.body).toMatchObject({
      jsonrpc: "2.0",
      id: 4,
      error: {
        code: -32601,
      },
    });
  });
});
