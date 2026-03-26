export function getOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Saatgut API",
      version: "1.1.0-v1-mcp",
      description:
        "Internal REST contract for the Saatgut seed-bank, journal, reminder, export, admin, and MCP APIs.",
    },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "saatgut_session",
        },
        bearerToken: {
          type: "http",
          scheme: "bearer",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: {},
              },
              required: ["code", "message"],
            },
          },
          required: ["error"],
        },
        ReminderTask: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            dueDate: { type: "string", format: "date-time" },
            status: {
              type: "string",
              enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "DISMISSED"],
            },
            source: {
              type: "string",
              enum: ["MANUAL", "CALENDAR", "JOURNAL", "QUALITY", "SYSTEM"],
            },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["id", "title", "dueDate", "status", "source", "tags"],
        },
        ApiToken: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            tokenPrefix: { type: "string" },
            scopes: {
              type: "array",
              items: { type: "string", enum: ["READ", "WRITE", "EXPORT", "ADMIN"] },
            },
            rateLimitPerMinute: { type: "integer" },
            expiresAt: { type: ["string", "null"], format: "date-time" },
            revokedAt: { type: ["string", "null"], format: "date-time" },
          },
          required: ["id", "name", "tokenPrefix", "scopes", "rateLimitPerMinute"],
        },
      },
    },
    security: [{ sessionCookie: [] }, { bearerToken: [] }],
    paths: {
      "/auth/register": {
        post: {
          summary: "Register the first user or a standalone workspace user",
          requestBody: { required: true },
          responses: { "201": { description: "Registered" }, "422": { description: "Validation error" } },
        },
      },
      "/auth/login": {
        post: {
          summary: "Create a cookie-backed session",
          requestBody: { required: true },
          responses: { "200": { description: "Logged in" }, "401": { description: "Invalid credentials" } },
        },
      },
      "/auth/passkeys/register/options": {
        post: { summary: "Begin passkey-first signup", security: [], responses: { "200": { description: "Registration options" } } },
      },
      "/auth/passkeys/register/verify": {
        post: { summary: "Verify passkey signup and create the initial workspace", security: [], responses: { "201": { description: "Registered" } } },
      },
      "/auth/passkeys/login/options": {
        post: { summary: "Begin passkey authentication", security: [], responses: { "200": { description: "Authentication options" } } },
      },
      "/auth/passkeys/login/verify": {
        post: { summary: "Verify passkey authentication and create a session", security: [], responses: { "200": { description: "Logged in" } } },
      },
      "/auth/passkeys/enroll/options": {
        post: { summary: "Begin passkey enrollment for an authenticated user", responses: { "200": { description: "Registration options" } } },
      },
      "/auth/passkeys/enroll/verify": {
        post: { summary: "Verify passkey enrollment for an authenticated user", responses: { "200": { description: "Passkey enrolled" } } },
      },
      "/auth/session": {
        get: { summary: "Fetch the authenticated session snapshot", responses: { "200": { description: "Session" } } },
        delete: { summary: "Clear the current session cookie", responses: { "200": { description: "Logged out" } } },
      },
      "/species": {
        get: { summary: "List species", responses: { "200": { description: "Species list" } } },
        post: { summary: "Create a species", responses: { "201": { description: "Created" } } },
      },
      "/species/{speciesId}": {
        patch: {
          summary: "Update a species",
          parameters: [{ name: "speciesId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          summary: "Delete a species when no varieties still depend on it",
          parameters: [{ name: "speciesId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "Deleted" } },
        },
      },
      "/varieties": {
        get: { summary: "List varieties", responses: { "200": { description: "Variety list" } } },
        post: { summary: "Create a variety", responses: { "201": { description: "Created" } } },
      },
      "/varieties/{varietyId}": {
        patch: {
          summary: "Update a variety",
          parameters: [{ name: "varietyId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          summary: "Delete a variety when it has no downstream catalog or history references",
          parameters: [{ name: "varietyId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "Deleted" } },
        },
      },
      "/seed-batches": {
        get: { summary: "List seed batches", responses: { "200": { description: "Seed batch list" } } },
        post: { summary: "Create a seed batch", responses: { "201": { description: "Created" } } },
      },
      "/seed-batches/{seedBatchId}": {
        patch: {
          summary: "Update seed batch catalog metadata",
          parameters: [{ name: "seedBatchId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          summary: "Delete a seed batch when it has no quality or operational history",
          parameters: [{ name: "seedBatchId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "Deleted" } },
        },
      },
      "/profiles": {
        get: { summary: "List growing profiles", responses: { "200": { description: "Profile list" } } },
        post: { summary: "Create a growing profile", responses: { "201": { description: "Created" } } },
      },
      "/profiles/{profileId}": {
        patch: {
          summary: "Update a growing profile",
          parameters: [{ name: "profileId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          summary: "Delete a growing profile",
          parameters: [{ name: "profileId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "Deleted" } },
        },
      },
      "/cultivation-rules": {
        get: { summary: "List cultivation rules", responses: { "200": { description: "Rule list" } } },
        post: { summary: "Upsert a cultivation rule", responses: { "200": { description: "Upserted" } } },
      },
      "/cultivation-rules/{ruleId}": {
        patch: {
          summary: "Update a cultivation rule",
          parameters: [{ name: "ruleId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          summary: "Delete a cultivation rule",
          parameters: [{ name: "ruleId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "Deleted" } },
        },
      },
      "/calendar": {
        get: { summary: "List calendar items", responses: { "200": { description: "Calendar list" } } },
      },
      "/plantings": {
        get: { summary: "List planting events", responses: { "200": { description: "Planting list" } } },
        post: { summary: "Create a planting event", responses: { "201": { description: "Created" } } },
      },
      "/plantings/{plantingId}": {
        patch: {
          summary: "Update a planting event and reconcile linked stock consumption if present",
          parameters: [{ name: "plantingId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          summary: "Delete a planting event and restore linked stock consumption if present",
          parameters: [{ name: "plantingId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "Deleted" } },
        },
      },
      "/journal": {
        get: { summary: "List journal entries", responses: { "200": { description: "Journal list" } } },
        post: { summary: "Create a journal entry", responses: { "201": { description: "Created" } } },
      },
      "/timeline": {
        get: { summary: "List unified timeline items", responses: { "200": { description: "Timeline list" } } },
      },
      "/tasks": {
        get: {
          summary: "List reminder tasks",
          responses: { "200": { description: "Task list", content: { "application/json": { schema: { $ref: "#/components/schemas/ReminderTask" } } } } },
        },
        post: { summary: "Create a reminder task", responses: { "201": { description: "Created" } } },
      },
      "/tasks/{taskId}": {
        patch: {
          summary: "Update reminder task status",
          parameters: [{ name: "taskId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
      },
      "/exports/workspace": {
        get: { summary: "Export workspace data as JSON", responses: { "200": { description: "Export bundle" } } },
      },
      "/backups/summary": {
        get: { summary: "Describe the supported backup artifacts and commands", responses: { "200": { description: "Backup summary" } } },
      },
      "/workspace/members": {
        get: { summary: "List workspace collaborators and pending invites", responses: { "200": { description: "Workspace member list" } } },
      },
      "/workspace/members/{userId}": {
        patch: {
          summary: "Update a collaborator role between member and viewer access",
          parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          summary: "Remove a collaborator from the workspace without deleting the underlying account",
          parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Removed" } },
        },
      },
      "/workspace/invites": {
        post: { summary: "Invite a collaborator to the current workspace", responses: { "201": { description: "Created" } } },
      },
      "/workspace/invites/accept": {
        post: {
          summary: "Accept a workspace invitation as a new or existing account",
          security: [{ sessionCookie: [] }],
          responses: { "200": { description: "Accepted" } },
        },
      },
      "/admin/api-tokens": {
        get: { summary: "List API tokens", responses: { "200": { description: "Token list" } } },
        post: { summary: "Create an API token", responses: { "201": { description: "Created" } } },
      },
      "/admin/api-tokens/{tokenId}/revoke": {
        post: {
          summary: "Revoke an API token",
          parameters: [{ name: "tokenId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Revoked" } },
        },
      },
      "/openapi.json": {
        get: {
          summary: "Generate the OpenAPI document for the current API surface",
          security: [],
          responses: { "200": { description: "OpenAPI document" } },
        },
      },
      "/mcp": {
        get: {
          summary: "Describe the MCP endpoint metadata and security expectations",
          security: [],
          responses: { "200": { description: "MCP endpoint metadata" } },
        },
        post: {
          summary: "Serve the Saatgut MCP JSON-RPC endpoint over HTTP",
          responses: { "200": { description: "MCP JSON-RPC response" } },
        },
      },
    },
  };
}
