import { z } from "zod";

import { RequestIdSchema } from "./common.js";
import { BridgeDeviceParamsSchema } from "./bridge.js";
import {
  PlaybackStreamIndexSchema,
  PlaybackTicksSchema,
} from "./play-ticket.js";

export const PlaybackEventParamsSchema = BridgeDeviceParamsSchema;

export const PlaybackPlayingRequestSchema = z.object({
  eventType: z.literal("playing"),
  isPaused: z.boolean(),
  playSessionId: z.uuid(),
  playbackRate: z.number().positive().max(16),
  positionTicks: PlaybackTicksSchema,
  sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export const PlaybackProgressEventNameSchema = z.enum([
  "audioTrackChange",
  "pause",
  "playbackRateChange",
  "seek",
  "subtitleTrackChange",
  "timeUpdate",
  "unpause",
]);

export const PlaybackProgressRequestSchema = z
  .object({
    audioStreamIndex: PlaybackStreamIndexSchema.nullable().optional(),
    eventName: PlaybackProgressEventNameSchema,
    eventType: z.literal("progress"),
    isPaused: z.boolean(),
    playSessionId: z.uuid(),
    playbackRate: z.number().positive().max(16),
    positionTicks: PlaybackTicksSchema,
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    subtitleStreamIndex: PlaybackStreamIndexSchema.nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.eventName === "audioTrackChange" &&
      value.audioStreamIndex === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "audioStreamIndex is required for an audio track change",
        path: ["audioStreamIndex"],
      });
    }
    if (
      value.eventName === "subtitleTrackChange" &&
      value.subtitleStreamIndex === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "subtitleStreamIndex is required for a subtitle track change",
        path: ["subtitleStreamIndex"],
      });
    }
  });

export const PlaybackEventRequestSchema = z.discriminatedUnion("eventType", [
  PlaybackPlayingRequestSchema,
  PlaybackProgressRequestSchema,
  z.object({
    eventType: z.literal("stopped"),
    playSessionId: z.uuid(),
    playbackRate: z.number().positive().max(16),
    positionTicks: PlaybackTicksSchema,
    reason: z.enum([
      "bridgeExit",
      "ended",
      "playerExit",
      "sessionLost",
      "userExit",
    ]),
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  }),
]);

export const PlaybackEventResponseSchema = z.object({
  duplicate: z.boolean().optional(),
  requestId: RequestIdSchema,
  success: z.literal(true),
});

export type PlaybackPlayingRequest = z.infer<
  typeof PlaybackPlayingRequestSchema
>;
export type PlaybackProgressRequest = z.infer<
  typeof PlaybackProgressRequestSchema
>;
export type PlaybackProgressEventName = z.infer<
  typeof PlaybackProgressEventNameSchema
>;
export type PlaybackEventRequest = z.infer<typeof PlaybackEventRequestSchema>;
export type PlaybackEventResponse = z.infer<typeof PlaybackEventResponseSchema>;
