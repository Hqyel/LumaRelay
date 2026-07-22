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

export const PlaybackDisplayTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .refine(
    (value) =>
      [...value].every((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code >= 32 && code !== 127;
      }),
    "Playback display title cannot contain control characters",
  );

const EmbyPlaybackIdSchema = z.string().trim().min(1).max(256);

export const PlaybackTrackSchema = z.object({
  bitrate: z.number().int().positive().optional(),
  channelLayout: z.string().trim().min(1).max(64).optional(),
  channels: z.number().int().positive().optional(),
  codec: z.string().trim().min(1).max(64).optional(),
  codecTag: z.string().trim().min(1).max(64).optional(),
  displayTitle: z.string().trim().min(1).max(256),
  index: PlaybackStreamIndexSchema,
  isDefault: z.boolean(),
  isExternal: z.boolean(),
  isForced: z.boolean().optional(),
  isHearingImpaired: z.boolean().optional(),
  isText: z.boolean(),
  kind: z.enum(["audio", "subtitle"]),
  language: z.string().trim().min(1).max(64).optional(),
  profile: z.string().trim().min(1).max(128).optional(),
  sampleRate: z.number().int().positive().optional(),
});

export const PlaybackVideoInfoSchema = z.object({
  aspectRatio: z.string().trim().min(1).max(64).optional(),
  bitDepth: z.number().int().positive().optional(),
  bitrate: z.number().int().positive().optional(),
  codec: z.string().trim().min(1).max(64).optional(),
  codecTag: z.string().trim().min(1).max(64).optional(),
  displayTitle: z.string().trim().min(1).max(256).optional(),
  dolbyVisionProfile: z.string().trim().min(1).max(128).optional(),
  frameRate: z.number().positive().optional(),
  height: z.number().int().positive().optional(),
  isInterlaced: z.boolean().optional(),
  level: z.number().nonnegative().optional(),
  pixelFormat: z.string().trim().min(1).max(64).optional(),
  profile: z.string().trim().min(1).max(128).optional(),
  refFrames: z.number().int().nonnegative().optional(),
  videoRange: z.string().trim().min(1).max(64).optional(),
  width: z.number().int().positive().optional(),
});

export const PlaybackMediaSourceSchema = z.object({
  audioTracks: z.array(PlaybackTrackSchema),
  bitrate: z.number().int().positive().optional(),
  container: z.string().trim().min(1).max(32).optional(),
  defaultAudioStreamIndex: PlaybackStreamIndexSchema.nullable(),
  defaultSubtitleStreamIndex: PlaybackStreamIndexSchema.nullable(),
  mediaSourceId: EmbyPlaybackIdSchema,
  name: z.string().trim().min(1).max(256),
  runtimeTicks: PlaybackTicksSchema,
  sizeBytes: z.number().int().nonnegative().optional(),
  subtitleTracks: z.array(PlaybackTrackSchema),
  supportsDirectStream: z.boolean(),
  video: PlaybackVideoInfoSchema.optional(),
});

export const PlaybackOptionsResponseSchema = z.object({
  itemId: EmbyPlaybackIdSchema,
  requestId: RequestIdSchema,
  sources: z.array(PlaybackMediaSourceSchema),
});

export const PlayTicketSelectionSchema = z.object({
  audioStreamIndex: PlaybackStreamIndexSchema.nullable(),
  displayTitle: PlaybackDisplayTitleSchema,
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

export const LocalPlaybackStartRequestSchema = z.object({
  playTicket: PlayTicketSchema,
});

export const LocalPlaybackStartResponseSchema = z.object({
  playSessionId: z.uuid(),
  player: z.literal("potplayer"),
  status: z.literal("launching"),
});

export type PlayTicket = z.infer<typeof PlayTicketSchema>;
export type PlayTicketSelection = z.infer<typeof PlayTicketSelectionSchema>;
export type PlaybackMediaSource = z.infer<typeof PlaybackMediaSourceSchema>;
export type PlaybackOptionsResponse = z.infer<
  typeof PlaybackOptionsResponseSchema
>;
export type PlaybackTrack = z.infer<typeof PlaybackTrackSchema>;
export type PlaybackVideoInfo = z.infer<typeof PlaybackVideoInfoSchema>;
export type LocalPlaybackStartRequest = z.infer<
  typeof LocalPlaybackStartRequestSchema
>;
export type LocalPlaybackStartResponse = z.infer<
  typeof LocalPlaybackStartResponseSchema
>;
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
