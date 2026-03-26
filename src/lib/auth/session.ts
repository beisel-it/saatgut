import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

export const SESSION_COOKIE_NAME = "saatgut_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  workspaceId: string;
  role: "ADMIN" | "MEMBER";
  membershipRole: "OWNER" | "MEMBER" | "VIEWER";
  exp: number;
};

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(encodedPayload).digest("base64url");
}

export function createSessionToken(
  payload: Omit<SessionPayload, "exp">,
  now = Date.now(),
): string {
  const encodedPayload = toBase64Url(
    JSON.stringify({
      ...payload,
      exp: now + SESSION_TTL_MS,
    } satisfies SessionPayload),
  );

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifySessionToken(
  token: string,
  now = Date.now(),
): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;

  if (payload.exp <= now) {
    return null;
  }

  return payload;
}
