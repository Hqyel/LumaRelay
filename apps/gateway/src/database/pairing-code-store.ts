import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { BRIDGE_PAIRING_CODE_LIFETIME_SECONDS } from "@newemby/contracts";
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
}

function hashPairingCode(value: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("newemby:bridge-pairing-code:")
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
  };
}
