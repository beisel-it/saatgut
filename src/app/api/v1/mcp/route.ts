import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { handleApiError, readJson } from "@/lib/server/http";
import { requireMcpAuth } from "@/lib/server/mcp/security";
import { getMcpEndpointMetadata, handleMcpRequest } from "@/lib/server/mcp/server";

function buildHeaders() {
  return {
    "Cache-Control": "no-store",
    "X-Saatgut-MCP-Protocol": "2025-06-18",
  };
}

export function GET() {
  return NextResponse.json(getMcpEndpointMetadata(), {
    headers: buildHeaders(),
  });
}

export async function POST(request: Request) {
  try {
    const auth = await requireMcpAuth(request, { scope: ApiTokenScope.READ });
    const result = await handleMcpRequest(auth, await readJson(request));

    if (!result.body) {
      return new NextResponse(null, {
        status: result.status,
        headers: buildHeaders(),
      });
    }

    return NextResponse.json(result.body, {
      status: result.status,
      headers: buildHeaders(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...buildHeaders(),
      Allow: "GET,POST,OPTIONS",
      "Accept-Post": "application/json",
    },
  });
}
