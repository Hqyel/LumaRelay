import { z } from "zod";

import { RequestIdSchema } from "./common.js";
import { BridgeDeviceParamsSchema } from "./bridge.js";
import { PlaybackTicksSchema } from "./play-ticket.js";

export const PlaybackEventParamsSchema = BridgeDeviceParamsSchema;

export const PlaybackPlayingRequestSchema = z.object({
  eventType: z.literal("playing"),
  isPaused: z.boolean(),
  playSessionId: z.uuid(),
  playbackRate: z.number().positive().max(16),
  positionTicks: PlaybackTicksSchema,
});

export const PlaybackEventResponseSchema = z.object({
  requestId: RequestIdSchema,
  success: z.literal(true),
});

export type PlaybackPlayingRequest = z.infer<
  typeof PlaybackPlayingRequestSchema
>;
export type PlaybackEventResponse = z.infer<typeof PlaybackEventResponseSchema>;
