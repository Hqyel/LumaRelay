import { createHmac, timingSafeEqual } from "node:crypto";

import type { BridgeDeviceSummary } from "@newemby/contracts";
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
}

function hashNonce(value: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("newemby:bridge-request-nonce:")
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
          device: {
            bridgeVersion: device.bridgeVersion,
            deviceId: device.id,
            lastSeenAt: authenticatedAtIso,
            name: device.name,
            pairedAt: device.createdAt,
            platform: "windows",
          },
        };
      });
    },
  };
}
