import { describe, expect, it } from "vitest";

import { getOpenApiDocument } from "@/lib/server/openapi";
import { passkeyResponseSchema, passkeySignupStartSchema } from "@/lib/server/schemas";

describe("passkey auth schemas", () => {
  it("accepts passkey signup start payloads", () => {
    expect(
      passkeySignupStartSchema.parse({
        email: "grower@example.com",
        workspaceName: "Saatgut Garten",
      }),
    ).toEqual({
      email: "grower@example.com",
      workspaceName: "Saatgut Garten",
    });
  });

  it("accepts opaque passkey response envelopes", () => {
    expect(
      passkeyResponseSchema.parse({
        response: {
          id: "credential-id",
          type: "public-key",
        },
      }),
    ).toEqual({
      response: {
        id: "credential-id",
        type: "public-key",
      },
    });
  });
});

describe("passkey auth OpenAPI paths", () => {
  it("includes passkey auth endpoints", () => {
    const document = getOpenApiDocument();

    expect(document.paths["/auth/passkeys/register/options"]).toBeDefined();
    expect(document.paths["/auth/passkeys/register/verify"]).toBeDefined();
    expect(document.paths["/auth/passkeys/login/options"]).toBeDefined();
    expect(document.paths["/auth/passkeys/login/verify"]).toBeDefined();
    expect(document.paths["/auth/passkeys/enroll/options"]).toBeDefined();
    expect(document.paths["/auth/passkeys/enroll/verify"]).toBeDefined();
  });
});
