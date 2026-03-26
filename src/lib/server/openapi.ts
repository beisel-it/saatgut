export function getOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Saatgut API",
      version: "1.0.0-v1-ops",
      description:
        "Internal REST contract for the Saatgut seed-bank, journal, reminder, export, and admin APIs.",
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
      "/auth/session": {
        get: { summary: "Fetch the authenticated session snapshot", responses: { "200": { description: "Session" } } },
        delete: { summary: "Clear the current session cookie", responses: { "200": { description: "Logged out" } } },
      },
      "/species": {
        get: { summary: "List species", responses: { "200": { description: "Species list" } } },
        post: { summary: "Create a species", responses: { "201": { description: "Created" } } },
      },
      "/varieties": {
        get: { summary: "List varieties", responses: { "200": { description: "Variety list" } } },
        post: { summary: "Create a variety", responses: { "201": { description: "Created" } } },
      },
      "/seed-batches": {
        get: { summary: "List seed batches", responses: { "200": { description: "Seed batch list" } } },
        post: { summary: "Create a seed batch", responses: { "201": { description: "Created" } } },
      },
      "/profiles": {
        get: { summary: "List growing profiles", responses: { "200": { description: "Profile list" } } },
        post: { summary: "Create a growing profile", responses: { "201": { description: "Created" } } },
      },
      "/cultivation-rules": {
        get: { summary: "List cultivation rules", responses: { "200": { description: "Rule list" } } },
        post: { summary: "Upsert a cultivation rule", responses: { "200": { description: "Upserted" } } },
      },
      "/calendar": {
        get: { summary: "List calendar items", responses: { "200": { description: "Calendar list" } } },
      },
      "/plantings": {
        get: { summary: "List planting events", responses: { "200": { description: "Planting list" } } },
        post: { summary: "Create a planting event", responses: { "201": { description: "Created" } } },
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
    },
  };
}
