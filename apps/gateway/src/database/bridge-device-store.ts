import { createHmac, timingSafeEqual } from "node:crypto";

import type { BridgeDeviceSummary } from "@lumarelay/contracts";
import type { Kysely } from "kysely";

import type { GatewayConfig } from "../config.js";
import { hashDeviceCredential } from "./pairing-code-store.js";
import type { DatabaseSchema } from "./types.js";

const NONCE_LIFETIME_MS = 5 * 60 * 1000;

export interface AuthenticateBridgeDeviceInput {
  deviceCredential: string;
  deviceId: string;
  nonce: string;
}

export type AuthenticateBridgeDeviceResult =
  | { kind: "authenticated"; device: BridgeDeviceSummary }
  | { kind: "invalid-credential" }
  | { kind: "replay" };

export interface BridgeDeviceStore {
  authenticate(
    input: AuthenticateBridgeDeviceInput,
  ): Promise<AuthenticateBridgeDeviceResult>;
  listForUser(serverId: string, userId: string): Promise<BridgeDeviceSummary[]>;
  revokeAuthenticated(deviceId: string): Promise<boolean>;
  revokeForUser(
    serverId: string,
    userId: string,
    deviceId: string,
  ): Promise<boolean>;
  revokeServerDevices(serverId: string): Promise<number>;
}

function toDeviceSummary(device: {
  bridgeVersion: string;
  createdAt: string;
  id: string;
  lastSeenAt: string;
  name: string;
}): BridgeDeviceSummary {
  return {
    bridgeVersion: device.bridgeVersion,
    deviceId: device.id,
    lastSeenAt: device.lastSeenAt,
    name: device.name,
    pairedAt: device.createdAt,
    platform: "windows",
  };
}

function hashNonce(value: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("lumarelay:bridge-request-nonce:")
    .update(value)
    .digest("hex");
}

function sameHash(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.byteLength === rightBuffer.byteLength &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createBridgeDeviceStore(
  database: Kysely<DatabaseSchema>,
  config: Pick<GatewayConfig, "sessionSecret">,
  now: () => Date = () => new Date(),
): BridgeDeviceStore {
  return {
    async authenticate(
      input: AuthenticateBridgeDeviceInput,
    ): Promise<AuthenticateBridgeDeviceResult> {
      return database.transaction().execute(async (transaction) => {
        const authenticatedAt = now();
        const authenticatedAtIso = authenticatedAt.toISOString();
        await transaction
          .deleteFrom("bridgeRequestNonces")
          .where("expiresAt", "<=", authenticatedAtIso)
          .execute();

        const device = await transaction
          .selectFrom("bridgeDevices")
          .selectAll()
          .where("id", "=", input.deviceId)
          .where("revokedAt", "is", null)
          .executeTakeFirst();
        const expectedCredentialHash = hashDeviceCredential(
          input.deviceCredential,
          config.sessionSecret,
        );
        if (
          device === undefined ||
          !sameHash(device.credentialHash, expectedCredentialHash)
        ) {
          return { kind: "invalid-credential" };
        }

        const inserted = await transaction
          .insertInto("bridgeRequestNonces")
          .values({
            deviceId: device.id,
            expiresAt: new Date(
              authenticatedAt.getTime() + NONCE_LIFETIME_MS,
            ).toISOString(),
            nonceHash: hashNonce(input.nonce, config.sessionSecret),
          })
          .onConflict((conflict) =>
            conflict.columns(["deviceId", "nonceHash"]).doNothing(),
          )
          .executeTakeFirst();
        if (Number(inserted.numInsertedOrUpdatedRows) !== 1)
          return { kind: "replay" };

        await transaction
          .updateTable("bridgeDevices")
          .set({ lastSeenAt: authenticatedAtIso })
          .where("id", "=", device.id)
          .execute();

        return {
          kind: "authenticated",
          device: toDeviceSummary({
            ...device,
            lastSeenAt: authenticatedAtIso,
          }),
        };
      });
    },

    async listForUser(
      serverId: string,
      userId: string,
    ): Promise<BridgeDeviceSummary[]> {
      const devices = await database
        .selectFrom("bridgeDevices")
        .selectAll()
        .where("serverId", "=", serverId)
        .where("embyUserId", "=", userId)
        .where("revokedAt", "is", null)
        .orderBy("lastSeenAt", "desc")
        .execute();
      return devices.map(toDeviceSummary);
    },

    async revokeAuthenticated(deviceId: string): Promise<boolean> {
      return database.transaction().execute(async (transaction) => {
        const revoked = await transaction
          .updateTable("bridgeDevices")
          .set({ revokedAt: now().toISOString() })
          .where("id", "=", deviceId)
          .where("revokedAt", "is", null)
          .executeTakeFirst();
        if (Number(revoked.numUpdatedRows) !== 1) return false;

        await transaction
          .deleteFrom("bridgeRequestNonces")
          .where("deviceId", "=", deviceId)
          .execute();
        return true;
      });
    },

    async revokeForUser(
      serverId: string,
      userId: string,
      deviceId: string,
    ): Promise<boolean> {
      return database.transaction().execute(async (transaction) => {
        const revoked = await transaction
          .updateTable("bridgeDevices")
          .set({ revokedAt: now().toISOString() })
          .where("id", "=", deviceId)
          .where("serverId", "=", serverId)
          .where("embyUserId", "=", userId)
          .where("revokedAt", "is", null)
          .executeTakeFirst();
        if (Number(revoked.numUpdatedRows) !== 1) return false;

        await transaction
          .deleteFrom("bridgeRequestNonces")
          .where("deviceId", "=", deviceId)
          .execute();
        return true;
      });
    },

    async revokeServerDevices(serverId: string): Promise<number> {
      const revoked = await database
        .updateTable("bridgeDevices")
        .set({ revokedAt: now().toISOString() })
        .where("serverId", "=", serverId)
        .where("revokedAt", "is", null)
        .executeTakeFirst();
      return Number(revoked.numUpdatedRows);
    },
  };
}
