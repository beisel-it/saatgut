import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(16).default("replace-with-local-dev-secret"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@127.0.0.1:5432/saatgut?schema=public"),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  API_TOKEN_DEFAULT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  MCP_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse({
  APP_URL: process.env.APP_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  API_RATE_LIMIT_PER_MINUTE: process.env.API_RATE_LIMIT_PER_MINUTE,
  API_TOKEN_DEFAULT_RATE_LIMIT_PER_MINUTE: process.env.API_TOKEN_DEFAULT_RATE_LIMIT_PER_MINUTE,
  MCP_ALLOWED_ORIGINS: process.env.MCP_ALLOWED_ORIGINS,
  NODE_ENV: process.env.NODE_ENV,
});
