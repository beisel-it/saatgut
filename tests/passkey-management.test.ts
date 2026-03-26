import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, writeAuditLogMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  writeAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/server/audit-log", () => ({
  writeAuditLog: writeAuditLogMock,
}));

import { ApiError } from "@/lib/server/api-error";
import { listPasskeyCredentials, removePasskeyCredential } from "@/lib/server/passkey-service";

const auth = {
  userId: "user_123",
  workspaceId: "workspace_123",
  role: "ADMIN" as const,
  membershipRole: "OWNER" as const,
  authMethod: "session" as const,
};

describe("passkey management service", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
    prismaMock.$transaction.mockReset();
    writeAuditLogMock.mockReset();
  });

  it("lists passkeys with management metadata", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: auth.userId,
      passwordHash: null,
      passkeys: [
        {
          id: "passkey_newer",
          credentialId: "newer-passkey-credential",
          deviceType: "MULTI_DEVICE",
          backedUp: true,
          transports: ["internal"],
          lastUsedAt: new Date("2026-03-27T10:00:00.000Z"),
          createdAt: new Date("2026-03-26T10:00:00.000Z"),
          updatedAt: new Date("2026-03-27T10:00:00.000Z"),
        },
        {
          id: "passkey_older",
          credentialId: "older-passkey-credential",
          deviceType: "SINGLE_DEVICE",
          backedUp: false,
          transports: ["usb"],
          lastUsedAt: null,
          createdAt: new Date("2026-03-20T10:00:00.000Z"),
          updatedAt: new Date("2026-03-20T10:00:00.000Z"),
        },
      ],
    });

    const result = await listPasskeyCredentials(auth);

    expect(result.passwordFallbackAvailable).toBe(false);
    expect(result.totalPasskeys).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual(["passkey_newer", "passkey_older"]);
    expect(result.items[0]).toMatchObject({
      credentialPreview: "newer-pa…tial",
      canRemove: true,
      removalBlockedReason: null,
    });
  });

  it("blocks removing the last passkey when no password fallback exists", async () => {
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: auth.userId,
            passwordHash: null,
            passkeys: [
              {
                id: "passkey_1",
                credentialId: "credential-1",
                deviceType: "MULTI_DEVICE",
                backedUp: true,
                transports: ["internal"],
                lastUsedAt: null,
                createdAt: new Date("2026-03-26T10:00:00.000Z"),
                updatedAt: new Date("2026-03-26T10:00:00.000Z"),
              },
            ],
          }),
        },
        passkeyCredential: {
          delete: vi.fn(),
        },
      }),
    );

    await expect(removePasskeyCredential(auth, "passkey_1")).rejects.toMatchObject({
      code: "LAST_SIGNIN_METHOD",
      status: 409,
    } satisfies Partial<ApiError>);
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("removes a passkey when another sign-in method remains", async () => {
    const deleteMock = vi.fn();

    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: auth.userId,
            passwordHash: "hashed-password",
            passkeys: [
              {
                id: "passkey_1",
                credentialId: "credential-1",
                deviceType: "MULTI_DEVICE",
                backedUp: true,
                transports: ["internal"],
                lastUsedAt: new Date("2026-03-27T10:00:00.000Z"),
                createdAt: new Date("2026-03-26T10:00:00.000Z"),
                updatedAt: new Date("2026-03-27T10:00:00.000Z"),
              },
            ],
          }),
        },
        passkeyCredential: {
          delete: deleteMock,
        },
      }),
    );

    const result = await removePasskeyCredential(auth, "passkey_1");

    expect(deleteMock).toHaveBeenCalledWith({
      where: { id: "passkey_1" },
    });
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      auth,
      "auth.passkeyRemove",
      "PasskeyCredential",
      "passkey_1",
      expect.objectContaining({ credentialId: "credential-1" }),
    );
    expect(result).toMatchObject({
      id: "passkey_1",
      credentialPreview: "credenti…al-1",
      canRemove: true,
      removalBlockedReason: null,
    });
  });
});
