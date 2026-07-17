import { z } from "zod";

import { RequestIdSchema } from "./common.js";

export const BRIDGE_PAIRING_CODE_LIFETIME_SECONDS = 60;

export const BridgePairingCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const BridgePairingCodeResponseSchema = z.object({
  expiresAt: z.iso.datetime(),
  expiresInSeconds: z.literal(BRIDGE_PAIRING_CODE_LIFETIME_SECONDS),
  pairingCode: BridgePairingCodeSchema,
  requestId: RequestIdSchema,
});

export type BridgePairingCodeResponse = z.infer<
  typeof BridgePairingCodeResponseSchema
>;
