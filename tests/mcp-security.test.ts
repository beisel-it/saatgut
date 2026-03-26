import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/server/api-error";
import { assertAllowedMcpOrigin, getAllowedMcpOrigins } from "@/lib/server/mcp/security";

describe("MCP security helpers", () => {
  it("parses allowed origins from comma-separated config", () => {
    expect(getAllowedMcpOrigins("http://localhost:3000, https://garden.example")).toEqual([
      "http://localhost:3000",
      "https://garden.example",
    ]);
  });

  it("allows requests without an origin header", () => {
    const request = new Request("http://localhost:3000/api/v1/mcp", {
      method: "POST",
    });

    expect(() => assertAllowedMcpOrigin(request, ["http://localhost:3000"])).not.toThrow();
  });

  it("rejects browser origins outside the allow-list", () => {
    const request = new Request("http://localhost:3000/api/v1/mcp", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
      },
    });

    expect(() => assertAllowedMcpOrigin(request, ["http://localhost:3000"])).toThrowError(ApiError);
  });
});
