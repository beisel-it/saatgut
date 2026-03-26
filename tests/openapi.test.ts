import { describe, expect, it } from "vitest";

import { getOpenApiDocument } from "@/lib/server/openapi";

describe("getOpenApiDocument", () => {
  it("includes the V1 operations endpoints", () => {
    const document = getOpenApiDocument();

    expect(document.paths["/tasks"]).toBeDefined();
    expect(document.paths["/timeline"]).toBeDefined();
    expect(document.paths["/exports/workspace"]).toBeDefined();
    expect(document.paths["/backups/summary"]).toBeDefined();
    expect(document.paths["/admin/api-tokens"]).toBeDefined();
  });
});
