import { randomBytes } from "node:crypto";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { MembershipRole, UserRole, WorkspaceVisibility, type PasskeyDeviceType } from "@prisma/client";

import type {
  PasskeyAuthenticationCeremony,
  PasskeyRegistrationCeremony,
} from "@/lib/auth/passkey-ceremony";
import { createSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/server/api-error";
import { writeAuditLog } from "@/lib/server/audit-log";
import type { AuthContext } from "@/lib/server/auth-context";

function defaultWorkspaceName(email: string): string {
  const localPart = email.split("@")[0] ?? "Saatgut";
  return `${localPart}'s Garden`;
}

function getWebAuthnConfig() {
  const appUrl = new URL(env.APP_URL);

  return {
    rpName: env.WEBAUTHN_RP_NAME,
    rpID: env.WEBAUTHN_RP_ID || appUrl.hostname,
    origins: env.WEBAUTHN_ALLOWED_ORIGINS.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

function createWebAuthnUserId(): string {
  return randomBytes(24).toString("base64url");
}

function encodeUserId(userId: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(userId);
}

function mapDeviceType(deviceType: "singleDevice" | "multiDevice"): PasskeyDeviceType {
  return deviceType === "multiDevice" ? "MULTI_DEVICE" : "SINGLE_DEVICE";
}

function mapTransports(transports?: AuthenticatorTransportFuture[]): string[] {
  return transports ? [...transports] : [];
}

async function getDefaultMembershipForUser(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    throw new ApiError(403, "NO_WORKSPACE", "No workspace membership was found for this user.");
  }

  return membership;
}

export async function beginPasskeySignup(input: { email: string; workspaceName?: string }) {
  const email = input.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ApiError(409, "EMAIL_IN_USE", "A user with that email already exists.");
  }

  const webauthnUserId = createWebAuthnUserId();
  const config = getWebAuthnConfig();
  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName: email,
    userID: encodeUserId(webauthnUserId),
    userDisplayName: email,
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  const ceremony = {
    mode: "signup",
    challenge: options.challenge,
    email,
    workspaceName: input.workspaceName?.trim() || undefined,
    webauthnUserId,
  } satisfies Omit<Extract<PasskeyRegistrationCeremony, { mode: "signup" }>, "exp">;

  return { options, ceremony };
}

export async function completePasskeySignup(
  ceremony: PasskeyRegistrationCeremony,
  response: RegistrationResponseJSON,
) {
  if (ceremony.mode !== "signup") {
    throw new ApiError(409, "PASSKEY_CEREMONY_MISMATCH", "Registration ceremony state is invalid.");
  }

  const config = getWebAuthnConfig();
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: ceremony.challenge,
    expectedOrigin: config.origins,
    expectedRPID: config.rpID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new ApiError(400, "PASSKEY_REGISTRATION_FAILED", "Passkey registration could not be verified.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: ceremony.email },
  });

  if (existingUser) {
    throw new ApiError(409, "EMAIL_IN_USE", "A user with that email already exists.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: ceremony.email,
        passwordHash: null,
        webauthnUserId: ceremony.webauthnUserId,
        role: UserRole.ADMIN,
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        name: ceremony.workspaceName || defaultWorkspaceName(ceremony.email),
        visibility: WorkspaceVisibility.PRIVATE,
      },
    });

    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: MembershipRole.OWNER,
      },
      include: { workspace: true },
    });

    const passkey = await tx.passkeyCredential.create({
      data: {
        userId: user.id,
        credentialId: verification.registrationInfo.credential.id,
        publicKey: Buffer.from(verification.registrationInfo.credential.publicKey),
        counter: verification.registrationInfo.credential.counter,
        transports: mapTransports(verification.registrationInfo.credential.transports),
        deviceType: mapDeviceType(verification.registrationInfo.credentialDeviceType),
        backedUp: verification.registrationInfo.credentialBackedUp,
      },
    });

    await writeAuditLog(tx, { userId: user.id, workspaceId: workspace.id }, "auth.registerPasskey", "User", user.id, {
      email: user.email,
      passkeyId: passkey.id,
    });

    return { user, membership };
  });

  return {
    user: result.user,
    membership: result.membership,
    sessionToken: createSessionToken({
      userId: result.user.id,
      workspaceId: result.membership.workspaceId,
      role: result.user.role,
      membershipRole: result.membership.role,
    }),
  };
}

export async function beginPasskeyEnrollment(auth: AuthContext) {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: { passkeys: true },
  });

  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "User account was not found.");
  }

  const webauthnUserId = user.webauthnUserId ?? createWebAuthnUserId();
  const config = getWebAuthnConfig();
  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName: user.email,
    userID: encodeUserId(webauthnUserId),
    userDisplayName: user.email,
    excludeCredentials: user.passkeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: passkey.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  const ceremony = {
    mode: "enroll",
    challenge: options.challenge,
    userId: user.id,
    webauthnUserId,
  } satisfies Omit<Extract<PasskeyRegistrationCeremony, { mode: "enroll" }>, "exp">;

  return { options, ceremony };
}

export async function completePasskeyEnrollment(
  auth: AuthContext,
  ceremony: PasskeyRegistrationCeremony,
  response: RegistrationResponseJSON,
) {
  if (ceremony.mode !== "enroll" || ceremony.userId !== auth.userId) {
    throw new ApiError(409, "PASSKEY_CEREMONY_MISMATCH", "Registration ceremony state is invalid.");
  }

  const config = getWebAuthnConfig();
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: ceremony.challenge,
    expectedOrigin: config.origins,
    expectedRPID: config.rpID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new ApiError(400, "PASSKEY_REGISTRATION_FAILED", "Passkey registration could not be verified.");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: auth.userId },
    });

    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "User account was not found.");
    }

    const existingPasskey = await tx.passkeyCredential.findUnique({
      where: { credentialId: verification.registrationInfo.credential.id },
    });

    if (existingPasskey) {
      throw new ApiError(409, "PASSKEY_ALREADY_REGISTERED", "This passkey is already registered.");
    }

    if (!user.webauthnUserId) {
      await tx.user.update({
        where: { id: user.id },
        data: { webauthnUserId: ceremony.webauthnUserId },
      });
    }

    const passkey = await tx.passkeyCredential.create({
      data: {
        userId: user.id,
        credentialId: verification.registrationInfo.credential.id,
        publicKey: Buffer.from(verification.registrationInfo.credential.publicKey),
        counter: verification.registrationInfo.credential.counter,
        transports: mapTransports(verification.registrationInfo.credential.transports),
        deviceType: mapDeviceType(verification.registrationInfo.credentialDeviceType),
        backedUp: verification.registrationInfo.credentialBackedUp,
      },
    });

    await writeAuditLog(tx, auth, "auth.passkeyEnroll", "PasskeyCredential", passkey.id, {
      credentialId: passkey.credentialId,
    });

    return passkey;
  });
}

export async function beginPasskeyAuthentication() {
  const config = getWebAuthnConfig();
  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: "preferred",
  });

  const ceremony = {
    mode: "authenticate",
    challenge: options.challenge,
  } satisfies Omit<PasskeyAuthenticationCeremony, "exp">;

  return { options, ceremony };
}

export async function completePasskeyAuthentication(
  ceremony: PasskeyAuthenticationCeremony,
  response: AuthenticationResponseJSON,
) {
  if (ceremony.mode !== "authenticate") {
    throw new ApiError(409, "PASSKEY_CEREMONY_MISMATCH", "Authentication ceremony state is invalid.");
  }

  const passkey = await prisma.passkeyCredential.findUnique({
    where: { credentialId: response.id },
    include: { user: true },
  });

  if (!passkey) {
    throw new ApiError(401, "INVALID_PASSKEY", "Passkey authentication could not be completed.");
  }

  const config = getWebAuthnConfig();
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: ceremony.challenge,
    expectedOrigin: config.origins,
    expectedRPID: config.rpID,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: passkey.counter,
      transports: passkey.transports as AuthenticatorTransportFuture[],
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    throw new ApiError(401, "INVALID_PASSKEY", "Passkey authentication could not be completed.");
  }

  if (!passkey.user.isActive) {
    throw new ApiError(403, "USER_DEACTIVATED", "This user account has been deactivated.");
  }

  const membership = await getDefaultMembershipForUser(passkey.userId);

  await prisma.$transaction(async (tx) => {
    await tx.passkeyCredential.update({
      where: { id: passkey.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        deviceType: mapDeviceType(verification.authenticationInfo.credentialDeviceType),
        backedUp: verification.authenticationInfo.credentialBackedUp,
        lastUsedAt: new Date(),
      },
    });

    await writeAuditLog(tx, { userId: passkey.userId, workspaceId: membership.workspaceId }, "auth.passkeyLogin", "PasskeyCredential", passkey.id, {
      credentialId: passkey.credentialId,
    });
  });

  return {
    user: passkey.user,
    membership,
    sessionToken: createSessionToken({
      userId: passkey.user.id,
      workspaceId: membership.workspaceId,
      role: passkey.user.role,
      membershipRole: membership.role,
    }),
  };
}
