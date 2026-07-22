import { z } from "zod";

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

export type PlayTicket = z.infer<typeof PlayTicketSchema>;
export type PlayTicketSelection = z.infer<typeof PlayTicketSelectionSchema>;
