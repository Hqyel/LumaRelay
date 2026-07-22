import { z } from "zod";

import { RequestIdSchema } from "./common.js";
import { BridgeDeviceParamsSchema } from "./bridge.js";

export const PLAY_TICKET_LIFETIME_SECONDS = 60;

export const PlayTicketIdSchema = z.uuid();

export const PlayTicketSecretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const PlayTicketSchema = z
  .string()
  .regex(
    /^pt1\.[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i,
  );

export const PlaybackStreamIndexSchema = z.number().int().nonnegative();

export const PlaybackTicksSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

const EmbyPlaybackIdSchema = z.string().trim().min(1).max(256);

export const PlayTicketSelectionSchema = z.object({
  audioStreamIndex: PlaybackStreamIndexSchema.nullable(),
  itemId: EmbyPlaybackIdSchema,
  mediaSourceId: EmbyPlaybackIdSchema,
  resumeTicks: PlaybackTicksSchema,
  subtitleStreamIndex: PlaybackStreamIndexSchema.nullable(),
});

export const CreatePlayTicketRequestSchema = PlayTicketSelectionSchema.extend({
  deviceId: BridgeDeviceParamsSchema.shape.deviceId,
});

export const CreatePlayTicketResponseSchema = z.object({
  expiresAt: z.iso.datetime(),
  expiresInSeconds: z.literal(PLAY_TICKET_LIFETIME_SECONDS),
  playSessionId: z.uuid(),
  playTicket: PlayTicketSchema,
  requestId: RequestIdSchema,
});

export const RedeemPlayTicketRequestSchema = z.object({
  playTicket: z.string().max(128),
});

export const RedeemPlayTicketResponseSchema = z.object({
  playSessionId: z.uuid(),
  requestId: RequestIdSchema,
  selection: PlayTicketSelectionSchema,
});

export type PlayTicket = z.infer<typeof PlayTicketSchema>;
export type PlayTicketSelection = z.infer<typeof PlayTicketSelectionSchema>;
export type CreatePlayTicketRequest = z.infer<
  typeof CreatePlayTicketRequestSchema
>;
export type CreatePlayTicketResponse = z.infer<
  typeof CreatePlayTicketResponseSchema
>;
export type RedeemPlayTicketRequest = z.infer<
  typeof RedeemPlayTicketRequestSchema
>;
export type RedeemPlayTicketResponse = z.infer<
  typeof RedeemPlayTicketResponseSchema
>;
