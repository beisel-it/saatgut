import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(16),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse({
  APP_URL: process.env.APP_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});
