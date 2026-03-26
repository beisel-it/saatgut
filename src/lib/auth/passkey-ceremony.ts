import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

const PASSKEY_CEREMONY_TTL_MS = 1000 * 60 * 10;
export const PASSKEY_REGISTRATION_COOKIE_NAME = "saatgut_passkey_registration";
export const PASSKEY_AUTHENTICATION_COOKIE_NAME = "saatgut_passkey_authentication";

type PasskeyBaseCeremony = {
  challenge: string;
  exp: number;
};

export type PasskeyRegistrationCeremony =
  | (PasskeyBaseCeremony & {
      mode: "signup";
      email: string;
      workspaceName?: string;
      webauthnUserId: string;
    })
  | (PasskeyBaseCeremony & {
      mode: "enroll";
      userId: string;
      webauthnUserId: string;
    });

export type PasskeyAuthenticationCeremony = PasskeyBaseCeremony & {
  mode: "authenticate";
};

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", `${env.AUTH_SECRET}:passkey`).update(encodedPayload).digest("base64url");
}

function createSignedToken<T extends PasskeyBaseCeremony>(
  payload: Omit<T, "exp">,
  now = Date.now(),
): string {
  const encodedPayload = toBase64Url(
    JSON.stringify({
      ...payload,
      exp: now + PASSKEY_CEREMONY_TTL_MS,
    }),
  );

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifySignedToken<T extends PasskeyBaseCeremony>(
  token: string,
  now = Date.now(),
): T | null {
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

  const payload = JSON.parse(fromBase64Url(encodedPayload)) as T;

  if (payload.exp <= now) {
    return null;
  }

  return payload;
}

export function createPasskeyRegistrationCeremonyToken(
  payload: Omit<Extract<PasskeyRegistrationCeremony, { mode: "signup" }>, "exp">,
  now?: number,
): string;
export function createPasskeyRegistrationCeremonyToken(
  payload: Omit<Extract<PasskeyRegistrationCeremony, { mode: "enroll" }>, "exp">,
  now?: number,
): string;
export function createPasskeyRegistrationCeremonyToken(
  payload: Omit<PasskeyRegistrationCeremony, "exp">,
  now = Date.now(),
): string {
  return createSignedToken(payload, now);
}

export function verifyPasskeyRegistrationCeremonyToken(
  token: string,
  now = Date.now(),
): PasskeyRegistrationCeremony | null {
  return verifySignedToken<PasskeyRegistrationCeremony>(token, now);
}

export function createPasskeyAuthenticationCeremonyToken<T extends PasskeyAuthenticationCeremony>(
  payload: Omit<T, "exp">,
  now = Date.now(),
): string {
  return createSignedToken(payload, now);
}

export function verifyPasskeyAuthenticationCeremonyToken(
  token: string,
  now = Date.now(),
): PasskeyAuthenticationCeremony | null {
  return verifySignedToken<PasskeyAuthenticationCeremony>(token, now);
}
