import { createHash, randomBytes } from "node:crypto";

export function createApiToken() {
  const token = randomBytes(24).toString("base64url");

  return {
    plainTextToken: token,
    tokenHash: hashApiToken(token),
    tokenPrefix: token.slice(0, 8),
  };
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
