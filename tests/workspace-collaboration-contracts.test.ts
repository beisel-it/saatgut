import { describe, expect, it } from "vitest";

import { getOpenApiDocument } from "@/lib/server/openapi";
import { inviteAcceptSchema, workspaceMemberRoleUpdateSchema } from "@/lib/server/schemas";

describe("workspace collaboration schemas", () => {
  it("accepts authenticated invite acceptance without a password", () => {
    expect(inviteAcceptSchema.parse({ token: "a".repeat(24) })).toEqual({
      token: "a".repeat(24),
    });
  });

  it("limits role updates to non-owner collaborator roles", () => {
    expect(workspaceMemberRoleUpdateSchema.parse({ role: "VIEWER" })).toEqual({
      role: "VIEWER",
    });

    expect(() => workspaceMemberRoleUpdateSchema.parse({ role: "OWNER" })).toThrow();
  });
});

describe("workspace collaboration OpenAPI paths", () => {
  it("includes workspace collaboration invite and member paths", () => {
    const document = getOpenApiDocument();

    expect(document.paths["/workspace/members"]).toBeDefined();
    expect(document.paths["/workspace/members/{userId}"]).toBeDefined();
    expect(document.paths["/workspace/invites"]).toBeDefined();
    expect(document.paths["/workspace/invites/accept"]).toBeDefined();
  });
});
