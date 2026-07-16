import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { UserPermissionsSchema, type UserProfile } from "@newemby/contracts";
import type { Kysely } from "kysely";

import type { GatewayConfig } from "../config.js";
import type { DatabaseSchema } from "./types.js";

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

interface EncryptedValue {
  ciphertext: string;
  iv: string;
  tag: string;
}

export interface CreateAuthSessionInput {
  accessToken: string;
  user: UserProfile;
}

export interface StoredAuthSession {
  accessToken: string;
  expiresAt: string;
  sessionId: string;
  user: UserProfile;
}

export interface AuthSessionStore {
  create(input: CreateAuthSessionInput): Promise<string>;
  find(cookieToken: string): Promise<StoredAuthSession | null>;
  getDeviceId(): Promise<string>;
  revoke(cookieToken: string): Promise<void>;
}

function encryptionKey(value: string): Buffer {
  const key = Buffer.from(value, "base64");

  if (key.length !== 32)
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");

  return key;
}

function encrypt(value: string, key: Buffer): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(value: EncryptedValue, key: Buffer): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function hashSecret(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createAuthSessionStore(
  database: Kysely<DatabaseSchema>,
  config: Pick<GatewayConfig, "sessionSecret" | "tokenEncryptionKey">,
): AuthSessionStore {
  const key = encryptionKey(config.tokenEncryptionKey);

  return {
    async create(input: CreateAuthSessionInput): Promise<string> {
      const cookieToken = randomBytes(32).toString("base64url");
      const encryptedToken = encrypt(input.accessToken, key);
      const now = new Date();

      await database
        .insertInto("authSessions")
        .values({
          accessTokenCiphertext: encryptedToken.ciphertext,
          accessTokenIv: encryptedToken.iv,
          accessTokenTag: encryptedToken.tag,
          createdAt: now.toISOString(),
          embyUserId: input.user.userId,
          expiresAt: new Date(
            now.getTime() + SESSION_LIFETIME_MS,
          ).toISOString(),
          id: randomUUID(),
          lastSeenAt: now.toISOString(),
          permissionsJson: JSON.stringify(input.user.permissions),
          primaryImageTag: input.user.primaryImageTag ?? null,
          revokedAt: null,
          secretHash: hashSecret(cookieToken, config.sessionSecret),
          serverId: input.user.serverId,
          userName: input.user.name,
        })
        .execute();

      return cookieToken;
    },

    async find(cookieToken: string): Promise<StoredAuthSession | null> {
      const now = new Date().toISOString();
      const session = await database
        .selectFrom("authSessions")
        .selectAll()
        .where("secretHash", "=", hashSecret(cookieToken, config.sessionSecret))
        .where("revokedAt", "is", null)
        .where("expiresAt", ">", now)
        .executeTakeFirst();

      if (session === undefined) return null;

      await database
        .updateTable("authSessions")
        .set({ lastSeenAt: now })
        .where("id", "=", session.id)
        .execute();

      return {
        accessToken: decrypt(
          {
            ciphertext: session.accessTokenCiphertext,
            iv: session.accessTokenIv,
            tag: session.accessTokenTag,
          },
          key,
        ),
        expiresAt: session.expiresAt,
        sessionId: session.id,
        user: {
          name: session.userName,
          permissions: UserPermissionsSchema.parse(
            JSON.parse(session.permissionsJson),
          ),
          primaryImageTag: session.primaryImageTag ?? undefined,
          serverId: session.serverId,
          userId: session.embyUserId,
        },
      };
    },

    async getDeviceId(): Promise<string> {
      const existing = await database
        .selectFrom("appSettings")
        .select("value")
        .where("key", "=", "gateway_device_id")
        .executeTakeFirst();

      if (existing !== undefined) return existing.value;

      const deviceId = randomUUID();
      await database
        .insertInto("appSettings")
        .values({ key: "gateway_device_id", value: deviceId })
        .onConflict((conflict) => conflict.column("key").doNothing())
        .execute();

      const stored = await database
        .selectFrom("appSettings")
        .select("value")
        .where("key", "=", "gateway_device_id")
        .executeTakeFirstOrThrow();
      return stored.value;
    },

    async revoke(cookieToken: string): Promise<void> {
      await database
        .updateTable("authSessions")
        .set({ revokedAt: new Date().toISOString() })
        .where("secretHash", "=", hashSecret(cookieToken, config.sessionSecret))
        .execute();
    },
  };
}
