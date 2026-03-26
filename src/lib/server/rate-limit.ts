import { env } from "@/lib/env";
import { ApiError } from "@/lib/server/api-error";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

export function assertRateLimit(input: {
  key: string;
  limit?: number;
  now?: number;
}) {
  const limit = input.limit ?? env.API_RATE_LIMIT_PER_MINUTE;
  const now = input.now ?? Date.now();
  const bucket = buckets.get(input.key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + WINDOW_MS });
    return { limit, remaining: limit - 1, resetAt: now + WINDOW_MS };
  }

  if (bucket.count >= limit) {
    throw new ApiError(429, "RATE_LIMIT_EXCEEDED", "Too many requests. Please retry in a minute.", {
      limit,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    });
  }

  bucket.count += 1;
  buckets.set(input.key, bucket);

  return {
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

export function getRateLimitKey(request: Request, identity: string) {
  const url = new URL(request.url);
  return `${identity}:${request.method}:${url.pathname}`;
}

export function assertAnonymousRateLimit(request: Request, namespace: string, limit?: number) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return assertRateLimit({
    key: getRateLimitKey(request, `${namespace}:${forwardedFor}`),
    limit,
  });
}
