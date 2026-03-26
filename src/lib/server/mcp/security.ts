import { ApiTokenScope } from "@prisma/client";

import { env } from "@/lib/env";
import { ApiError } from "@/lib/server/api-error";
import { requireAuth } from "@/lib/server/auth-context";

function normalizeOrigin(origin: string): string {
  return new URL(origin).origin;
}

export function getAllowedMcpOrigins(rawOrigins = env.MCP_ALLOWED_ORIGINS): string[] {
  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
}

export function assertAllowedMcpOrigin(request: Request, allowedOrigins = getAllowedMcpOrigins()): void {
  const origin = request.headers.get("origin");

  if (!origin) {
    return;
  }

  if (allowedOrigins.length === 0) {
    return;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (!allowedOrigins.includes(normalizedOrigin)) {
    throw new ApiError(403, "MCP_ORIGIN_DENIED", "MCP origin is not allowed.", {
      origin: normalizedOrigin,
    });
  }
}

export async function requireMcpAuth(
  request: Request,
  options: { scope?: ApiTokenScope } = {},
) {
  assertAllowedMcpOrigin(request);

  const auth = await requireAuth(request, options);

  if (auth.authMethod !== "api_token") {
    throw new ApiError(
      403,
      "MCP_API_TOKEN_REQUIRED",
      "The MCP endpoint requires bearer API token authentication.",
    );
  }

  return auth;
}
