import { createHmac, randomBytes, randomUUID } from "node:crypto";

import {
  BRIDGE_PAIRING_CODE_LIFETIME_SECONDS,
  type BridgeDeviceSummary,
  type RedeemBridgePairingCodeRequest,
} from "@newemby/contracts";
import type { Kysely } from "kysely";

import type { GatewayConfig } from "../config.js";
import type { DatabaseSchema } from "./types.js";

const PAIRING_CODE_LIFETIME_MS = BRIDGE_PAIRING_CODE_LIFETIME_SECONDS * 1000;

export interface IssuedPairingCode {
  expiresAt: string;
  pairingCode: string;
}

export interface PairingCodeStore {
  issue(authSessionId: string): Promise<IssuedPairingCode>;
  pruneExpired(): Promise<number>;
  redeem(
    input: RedeemBridgePairingCodeRequest,
  ): Promise<RedeemedPairingCode | null>;
}

export interface RedeemedPairingCode {
  device: BridgeDeviceSummary;
  deviceCredential: string;
}

function hashPairingCode(value: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("newemby:bridge-pairing-code:")
    .update(value)
    .digest("hex");
}

export function hashDeviceCredential(value: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("newemby:bridge-device-credential:")
    .update(value)
    .digest("hex");
}

export function createPairingCodeStore(
  database: Kysely<DatabaseSchema>,
  config: Pick<GatewayConfig, "sessionSecret">,
  now: () => Date = () => new Date(),
): PairingCodeStore {
  return {
    async issue(authSessionId: string): Promise<IssuedPairingCode> {
      const pairingCode = randomBytes(32).toString("base64url");
      const createdAt = now();
      const expiresAt = new Date(
        createdAt.getTime() + PAIRING_CODE_LIFETIME_MS,
      );

      await database.transaction().execute(async (transaction) => {
        await transaction
          .deleteFrom("bridgePairingCodes")
          .where((expression) =>
            expression.or([
              expression("authSessionId", "=", authSessionId),
              expression("expiresAt", "<=", createdAt.toISOString()),
            ]),
          )
          .execute();
        await transaction
          .insertInto("bridgePairingCodes")
          .values({
            authSessionId,
            codeHash: hashPairingCode(pairingCode, config.sessionSecret),
            createdAt: createdAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            id: randomUUID(),
          })
          .execute();
      });

      return {
        expiresAt: expiresAt.toISOString(),
        pairingCode,
      };
    },

    async pruneExpired(): Promise<number> {
      const result = await database
        .deleteFrom("bridgePairingCodes")
        .where("expiresAt", "<=", now().toISOString())
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    },

    async redeem(
      input: RedeemBridgePairingCodeRequest,
    ): Promise<RedeemedPairingCode | null> {
      return database.transaction().execute(async (transaction) => {
        const redeemedAt = now().toISOString();
        const codeHash = hashPairingCode(
          input.pairingCode,
          config.sessionSecret,
        );
        const pairing = await transaction
          .selectFrom("bridgePairingCodes")
          .innerJoin(
            "authSessions",
            "authSessions.id",
            "bridgePairingCodes.authSessionId",
          )
          .select([
            "bridgePairingCodes.id as pairingCodeId",
            "authSessions.embyUserId as embyUserId",
            "authSessions.serverId as serverId",
          ])
          .where("bridgePairingCodes.codeHash", "=", codeHash)
          .where("bridgePairingCodes.expiresAt", ">", redeemedAt)
          .where("authSessions.expiresAt", ">", redeemedAt)
          .where("authSessions.revokedAt", "is", null)
          .executeTakeFirst();

        if (pairing === undefined) {
          await transaction
            .deleteFrom("bridgePairingCodes")
            .where("codeHash", "=", codeHash)
            .execute();
          return null;
        }

        const consumed = await transaction
          .deleteFrom("bridgePairingCodes")
          .where("id", "=", pairing.pairingCodeId)
          .where("codeHash", "=", codeHash)
          .executeTakeFirst();
        if (Number(consumed.numDeletedRows) !== 1) return null;

        const deviceId = randomUUID();
        const deviceCredential = randomBytes(32).toString("base64url");
        await transaction
          .insertInto("bridgeDevices")
          .values({
            bridgeVersion: input.bridgeVersion,
            createdAt: redeemedAt,
            credentialHash: hashDeviceCredential(
              deviceCredential,
              config.sessionSecret,
            ),
            embyUserId: pairing.embyUserId,
            id: deviceId,
            lastSeenAt: redeemedAt,
            name: input.deviceName,
            platform: input.platform,
            revokedAt: null,
            serverId: pairing.serverId,
          })
          .execute();

        return {
          device: {
            bridgeVersion: input.bridgeVersion,
            deviceId,
            lastSeenAt: redeemedAt,
            name: input.deviceName,
            pairedAt: redeemedAt,
            platform: input.platform,
          },
          deviceCredential,
        };
      });
    },
  };
}
