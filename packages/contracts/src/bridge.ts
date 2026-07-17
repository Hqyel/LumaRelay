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

export const BridgePlatformSchema = z.enum(["windows"]);

export const BridgeDeviceNameSchema = z.string().trim().min(1).max(80);

export const BridgeVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);

export const BridgeDeviceSummarySchema = z.object({
  bridgeVersion: BridgeVersionSchema,
  deviceId: z.uuid(),
  lastSeenAt: z.iso.datetime(),
  name: BridgeDeviceNameSchema,
  pairedAt: z.iso.datetime(),
  platform: BridgePlatformSchema,
});

export const RedeemBridgePairingCodeRequestSchema = z.object({
  bridgeVersion: BridgeVersionSchema,
  deviceName: BridgeDeviceNameSchema,
  pairingCode: BridgePairingCodeSchema,
  platform: BridgePlatformSchema,
});

export const RedeemBridgePairingCodeResponseSchema = z.object({
  allowedOrigins: z.array(z.url()).min(1),
  device: BridgeDeviceSummarySchema,
  deviceCredential: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  requestId: RequestIdSchema,
});

export const BridgeDeviceParamsSchema = z.object({
  deviceId: z.uuid(),
});

export const BridgeDeviceAuthHeadersSchema = z.object({
  authorization: z.string().optional(),
  "x-newemby-nonce": z.string().optional(),
});

export const BridgeHeartbeatResponseSchema = z.object({
  requestId: RequestIdSchema,
  serverTime: z.iso.datetime(),
  status: z.literal("ok"),
});

export type BridgePairingCodeResponse = z.infer<
  typeof BridgePairingCodeResponseSchema
>;
export type BridgeDeviceSummary = z.infer<typeof BridgeDeviceSummarySchema>;
export type RedeemBridgePairingCodeRequest = z.infer<
  typeof RedeemBridgePairingCodeRequestSchema
>;
export type RedeemBridgePairingCodeResponse = z.infer<
  typeof RedeemBridgePairingCodeResponseSchema
>;
export type BridgeHeartbeatResponse = z.infer<
  typeof BridgeHeartbeatResponseSchema
>;
